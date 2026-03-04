//! BLAKE3 WASI component benchmarks using Wasmtime.
//!
//! Loads BLAKE3 WASM components (built via `cargo component build`)
//! and benchmarks them using the typed WIT bindings.

// Bench binary: panics are appropriate for fatal errors, and precision
// loss from u128→f64 / usize→f64 casts is negligible for timing data.
#![allow(
    clippy::panic,
    clippy::cast_precision_loss,
    clippy::cast_sign_loss,
    clippy::write_with_newline
)]

use std::collections::HashMap;
use std::fmt::Write;
use std::path::Path;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use wasmtime_wasi::{ResourceTable, WasiCtx, WasiCtxBuilder, WasiCtxView, WasiView};

wasmtime::component::bindgen!({
    path: "../../wit",
    world: "blake3",
});

struct HostState {
    ctx: WasiCtx,
    table: ResourceTable,
}

impl WasiView for HostState {
    fn ctx(&mut self) -> WasiCtxView<'_> {
        WasiCtxView {
            ctx: &mut self.ctx,
            table: &mut self.table,
        }
    }
}

fn new_store(engine: &wasmtime::Engine) -> wasmtime::Store<HostState> {
    let ctx = WasiCtxBuilder::new().build();
    wasmtime::Store::new(
        engine,
        HostState {
            ctx,
            table: ResourceTable::new(),
        },
    )
}

fn new_linker(engine: &wasmtime::Engine) -> wasmtime::component::Linker<HostState> {
    let mut linker = wasmtime::component::Linker::new(engine);
    wasmtime_wasi::p2::add_to_linker_sync(&mut linker)
        .unwrap_or_else(|e| panic!("Failed to add WASI to linker: {e}"));
    linker
}

// ── Result types (matches TS BenchSuiteResult format) ────────────────────────

#[derive(Serialize)]
struct BenchSuiteResult {
    runtime: String,
    timestamp: String,
    groups: Vec<BenchGroupResult>,
    wasm_sizes: Vec<WasmSize>,
    runner_categories: HashMap<String, String>,
}

#[derive(Serialize)]
struct BenchGroupResult {
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data_bytes: Option<u64>,
    results: Vec<BenchResult>,
}

#[derive(Serialize)]
struct BenchResult {
    name: String,
    category: String,
    stats: BenchStats,
}

#[derive(Serialize)]
struct BenchStats {
    mean_ns: f64,
    ops_per_second: f64,
    std_dev_ns: f64,
    sample_size: usize,
    confidence_interval_ns: (f64, f64),
    p50_ns: f64,
    p75_ns: f64,
    p90_ns: f64,
    p95_ns: f64,
    p99_ns: f64,
    min_ns: f64,
    max_ns: f64,
}

#[derive(Serialize)]
struct WasmSize {
    label: String,
    bytes: u64,
}

// ── Benchmark engine ─────────────────────────────────────────────────────────

fn bench_duration_ms() -> u128 {
    std::env::var("BENCH_DURATION")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(3000)
}

fn bench_warmup_iterations() -> u32 {
    std::env::var("BENCH_WARMUP")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(10)
}

/// Compare two `f64` values for sorting (NaN-safe).
/// Takes references to match `slice::sort_by` signature.
#[allow(clippy::trivially_copy_pass_by_ref)]
fn cmp_f64(a: &f64, b: &f64) -> std::cmp::Ordering {
    a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal)
}

/// Insert comma thousands separators into a numeric string (no decimals).
fn insert_commas(s: &str) -> String {
    let bytes: Vec<u8> = s.bytes().collect();
    let mut result = String::new();
    for (i, &b) in bytes.iter().enumerate() {
        if i > 0 && (bytes.len() - i).is_multiple_of(3) {
            result.push(',');
        }
        result.push(b as char);
    }
    result
}

/// Compute median of a sorted slice.
fn median_sorted(s: &[f64]) -> f64 {
    let n = s.len();
    if n == 0 {
        return 0.0;
    }
    if n % 2 == 1 {
        s[n / 2]
    } else {
        f64::midpoint(s[n / 2 - 1], s[n / 2])
    }
}

/// Percentile of a sorted slice using linear interpolation (R-7 method).
fn percentile_sorted(s: &[f64], p: f64) -> f64 {
    let n = s.len();
    if n == 0 {
        return 0.0;
    }
    let h = p * (n - 1) as f64;
    let lo = h.floor() as usize;
    let hi = (lo + 1).min(n - 1);
    let frac = h - lo as f64;
    s[lo] + frac * (s[hi] - s[lo])
}

/// MAD-based outlier removal matching fuz_util's `stats_outliers_mad`.
///
/// Algorithm:
/// 1. Sort, compute median.
/// 2. Compute MAD = median of |xi - median|.
/// 3. If MAD == 0, return all samples unchanged.
/// 4. Modified Z-score: |0.6745 * (x - median) / MAD|.
/// 5. If |z| > 3.5 → outlier. If >30% are outliers → re-threshold at 5.0.
/// 6. If still >40% are outliers → keep the 80% closest to median.
fn filter_outliers_mad(samples: &[f64]) -> Vec<f64> {
    const Z_THRESHOLD: f64 = 3.5;
    const Z_EXTREME: f64 = 5.0;
    const MAD_CONSTANT: f64 = 0.6745;
    const RATIO_HIGH: f64 = 0.3;
    const RATIO_EXTREME: f64 = 0.4;
    const KEEP_RATIO: f64 = 0.8;

    if samples.len() < 3 {
        return samples.to_vec();
    }

    let mut sorted = samples.to_vec();
    sorted.sort_by(cmp_f64);
    let med = median_sorted(&sorted);

    let mut deviations: Vec<f64> = samples.iter().map(|&x| (x - med).abs()).collect();
    deviations.sort_by(cmp_f64);
    let mad = median_sorted(&deviations);

    if mad == 0.0 {
        return samples.to_vec();
    }

    let classify = |threshold: f64| -> (Vec<f64>, Vec<f64>) {
        let mut cleaned = Vec::new();
        let mut outliers = Vec::new();
        for &x in samples {
            let z = (MAD_CONSTANT * (x - med) / mad).abs();
            if z > threshold {
                outliers.push(x);
            } else {
                cleaned.push(x);
            }
        }
        (cleaned, outliers)
    };

    let (cleaned, outliers) = classify(Z_THRESHOLD);
    if outliers.len() as f64 / samples.len() as f64 <= RATIO_HIGH {
        return cleaned;
    }

    let (cleaned, outliers) = classify(Z_EXTREME);
    if outliers.len() as f64 / samples.len() as f64 <= RATIO_EXTREME {
        return cleaned;
    }

    // Keep the 80% closest to median
    let keep = (samples.len() as f64 * KEEP_RATIO).floor() as usize;
    let mut with_dist: Vec<(f64, f64)> = samples.iter().map(|&x| (x, (x - med).abs())).collect();
    with_dist.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
    with_dist.truncate(keep);
    with_dist.iter().map(|&(x, _)| x).collect()
}

fn compute_stats(samples: &[f64]) -> BenchStats {
    let cleaned = filter_outliers_mad(samples);
    let mut s = cleaned;
    s.sort_by(cmp_f64);
    let n = s.len();
    let sum: f64 = s.iter().sum();
    let mean_ns = sum / n as f64;
    let ops_per_second = if mean_ns > 0.0 {
        1_000_000_000.0 / mean_ns
    } else {
        0.0
    };

    let std_dev_ns = if n > 1 {
        (s.iter().map(|&x| (x - mean_ns).powi(2)).sum::<f64>() / (n - 1) as f64).sqrt()
    } else {
        0.0
    };
    let ci_margin = if n > 1 {
        1.96 * std_dev_ns / (n as f64).sqrt()
    } else {
        0.0
    };

    BenchStats {
        mean_ns,
        ops_per_second,
        std_dev_ns,
        sample_size: n,
        confidence_interval_ns: (mean_ns - ci_margin, mean_ns + ci_margin),
        p50_ns: median_sorted(&s),
        p75_ns: percentile_sorted(&s, 0.75),
        p90_ns: percentile_sorted(&s, 0.90),
        p95_ns: percentile_sorted(&s, 0.95),
        p99_ns: percentile_sorted(&s, 0.99),
        min_ns: s[0],
        max_ns: s[n - 1],
    }
}

/// Format throughput as MB/s (with comma separators) or KB/s.
fn format_throughput(ops_per_second: f64, data_bytes: u64) -> String {
    let mb_s = ops_per_second * data_bytes as f64 / 1_000_000.0;
    if mb_s >= 1.0 {
        format!(
            "{} MB/s",
            insert_commas(&format!("{}", mb_s.round() as u64))
        )
    } else {
        format!("{:.1} KB/s", mb_s * 1000.0)
    }
}

struct ComponentProfile {
    label: String,
    wasm_path: String,
}

// ── Test vector types ────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct TestVector {
    label: String,
    input_hex: String,
    hash: String,
    keyed_hash: String,
    keyed_hash_key_hex: String,
    derive_key: String,
    derive_key_context: String,
}

fn hex_to_bytes(hex: &str) -> Vec<u8> {
    (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).unwrap_or(0))
        .collect()
}

fn to_hex(bytes: &[u8]) -> String {
    use std::fmt::Write as _;
    bytes
        .iter()
        .fold(String::with_capacity(bytes.len() * 2), |mut s, b| {
            write!(s, "{b:02x}").unwrap_or(());
            s
        })
}

fn bench_one_shot(
    engine: &wasmtime::Engine,
    linker: &wasmtime::component::Linker<HostState>,
    profiles: &[ComponentProfile],
    group_name: String,
    data_bytes: u64,
    op: impl Fn(&Blake3, &mut wasmtime::Store<HostState>),
) -> BenchGroupResult {
    let mut results = Vec::new();

    for profile in profiles {
        let path = Path::new(&profile.wasm_path);
        if !path.exists() {
            eprintln!("  Skipping {} (not built)", profile.label);
            continue;
        }

        let component = wasmtime::component::Component::from_file(engine, path)
            .unwrap_or_else(|e| panic!("Failed to load {}: {e}", profile.wasm_path));
        let mut store = new_store(engine);
        let instance = Blake3::instantiate(&mut store, &component, linker)
            .unwrap_or_else(|e| panic!("Failed to instantiate {}: {e}", profile.label));

        // Warmup
        for _ in 0..bench_warmup_iterations() {
            op(&instance, &mut store);
        }

        // Benchmark
        let mut samples = Vec::new();
        let deadline = Instant::now() + Duration::from_millis(bench_duration_ms() as u64);
        while Instant::now() < deadline {
            let start = Instant::now();
            op(&instance, &mut store);
            samples.push(start.elapsed().as_nanos() as f64);
        }

        let stats = compute_stats(&samples);
        let mean_us = stats.mean_ns / 1000.0;
        let throughput = format_throughput(stats.ops_per_second, data_bytes);
        eprintln!(
            "  {:<28} {:>12}  {:>10.2} \u{b5}s",
            profile.label, throughput, mean_us,
        );

        results.push(BenchResult {
            name: profile.label.clone(),
            category: "blake3".to_string(),
            stats,
        });
    }

    BenchGroupResult {
        name: group_name,
        data_bytes: Some(data_bytes),
        results,
    }
}

fn bench_streaming(
    engine: &wasmtime::Engine,
    linker: &wasmtime::component::Linker<HostState>,
    profiles: &[ComponentProfile],
    label: &str,
    data: &[u8],
    chunk_size: usize,
) -> BenchGroupResult {
    let chunks: Vec<&[u8]> = data.chunks(chunk_size).collect();

    let mut results = Vec::new();

    for profile in profiles {
        let path = Path::new(&profile.wasm_path);
        if !path.exists() {
            eprintln!("  Skipping {} (not built)", profile.label);
            continue;
        }

        let component = wasmtime::component::Component::from_file(engine, path)
            .unwrap_or_else(|e| panic!("Failed to load {}: {e}", profile.wasm_path));
        let mut store = new_store(engine);
        let instance = Blake3::instantiate(&mut store, &component, linker)
            .unwrap_or_else(|e| panic!("Failed to instantiate {}: {e}", profile.label));

        let hashing = instance.fuzdev_blake3_hashing();

        // Warmup
        for _ in 0..bench_warmup_iterations() {
            let hasher = hashing
                .hasher()
                .call_constructor(&mut store)
                .unwrap_or_else(|e| panic!("Failed to create hasher for {}: {e}", profile.label));
            for chunk in &chunks {
                hashing
                    .hasher()
                    .call_update(&mut store, hasher, chunk)
                    .unwrap_or_else(|e| {
                        panic!("Failed to update hasher for {}: {e}", profile.label)
                    });
            }
            let _ = hashing.hasher().call_finalize(&mut store, hasher);
            hasher
                .resource_drop(&mut store)
                .unwrap_or_else(|e| panic!("Failed to drop hasher for {}: {e}", profile.label));
        }

        // Benchmark
        let mut samples = Vec::new();
        let deadline = Instant::now() + Duration::from_millis(bench_duration_ms() as u64);
        while Instant::now() < deadline {
            let start = Instant::now();
            let hasher = hashing
                .hasher()
                .call_constructor(&mut store)
                .unwrap_or_else(|e| panic!("Failed to create hasher for {}: {e}", profile.label));
            for chunk in &chunks {
                hashing
                    .hasher()
                    .call_update(&mut store, hasher, chunk)
                    .unwrap_or_else(|e| {
                        panic!("Failed to update hasher for {}: {e}", profile.label)
                    });
            }
            let _ = hashing.hasher().call_finalize(&mut store, hasher);
            hasher
                .resource_drop(&mut store)
                .unwrap_or_else(|e| panic!("Failed to drop hasher for {}: {e}", profile.label));
            samples.push(start.elapsed().as_nanos() as f64);
        }

        let stats = compute_stats(&samples);
        let mean_us = stats.mean_ns / 1000.0;
        let throughput = format_throughput(stats.ops_per_second, data.len() as u64);
        eprintln!(
            "  {:<28} {:>12}  {:>10.2} \u{b5}s",
            profile.label, throughput, mean_us,
        );

        results.push(BenchResult {
            name: profile.label.clone(),
            category: "blake3".to_string(),
            stats,
        });
    }

    BenchGroupResult {
        name: format!("streaming ({label})"),
        data_bytes: Some(data.len() as u64),
        results,
    }
}

// ── Markdown formatting ──────────────────────────────────────────────────────

/// Time unit for display, auto-detected from mean values.
enum TimeUnit {
    Nanoseconds,
    Microseconds,
    Milliseconds,
    Seconds,
}

impl TimeUnit {
    fn detect(mean_ns_values: &[f64]) -> Self {
        let max = mean_ns_values.iter().copied().fold(0.0_f64, f64::max);
        if max < 1_000.0 {
            Self::Nanoseconds
        } else if max < 1_000_000.0 {
            Self::Microseconds
        } else if max < 1_000_000_000.0 {
            Self::Milliseconds
        } else {
            Self::Seconds
        }
    }

    fn label(&self) -> &'static str {
        match self {
            Self::Nanoseconds => "ns",
            Self::Microseconds => "\u{b5}s",
            Self::Milliseconds => "ms",
            Self::Seconds => "s",
        }
    }

    fn convert(&self, ns: f64) -> f64 {
        match self {
            Self::Nanoseconds => ns,
            Self::Microseconds => ns / 1_000.0,
            Self::Milliseconds => ns / 1_000_000.0,
            Self::Seconds => ns / 1_000_000_000.0,
        }
    }
}

fn format_number(n: f64) -> String {
    let s = format!("{n:.2}");
    let (int_part, frac_part) = s.split_once('.').unwrap_or((&s, ""));
    format!("{}.{frac_part}", insert_commas(int_part))
}

/// Determine which section a benchmark group belongs to.
fn get_bench_section(group_name: &str) -> &'static str {
    if group_name.starts_with("streaming") {
        "streaming"
    } else if group_name.contains("_stream") {
        "stream_fn"
    } else {
        "one_shot"
    }
}

/// Human-readable section header.
fn section_header(section: &str) -> &'static str {
    match section {
        "streaming" => "Streaming (manual hasher loop)",
        "stream_fn" => "Stream convenience functions (ReadableStream)",
        _ => "One-shot functions",
    }
}

#[allow(clippy::unwrap_used)] // write! to String is infallible
fn format_group_markdown(group: &BenchGroupResult, unit: &TimeUnit) -> String {
    let u = unit.label();
    let mut out = String::new();

    // Find baseline (fastest ops/sec)
    let baseline_ops = group
        .results
        .iter()
        .map(|r| r.stats.ops_per_second)
        .fold(0.0_f64, f64::max);

    // Build rows
    let header = [
        "Task Name",
        "ops/sec",
        "Throughput",
        &format!("p50 ({u})"),
        &format!("p75 ({u})"),
        &format!("p90 ({u})"),
        &format!("p95 ({u})"),
        &format!("p99 ({u})"),
        &format!("min ({u})"),
        &format!("max ({u})"),
        "vs Best",
    ];

    let mut rows: Vec<Vec<String>> = Vec::new();
    for r in &group.results {
        let s = &r.stats;
        let ratio = baseline_ops / s.ops_per_second;
        let vs = if (ratio - 1.0).abs() < 0.005 {
            "baseline".to_string()
        } else {
            format!("{ratio:.2}x")
        };
        let throughput = group
            .data_bytes
            .map(|db| format_throughput(s.ops_per_second, db))
            .unwrap_or_default();
        rows.push(vec![
            r.name.clone(),
            format_number(s.ops_per_second),
            throughput,
            format!("{:.2}", unit.convert(s.p50_ns)),
            format!("{:.2}", unit.convert(s.p75_ns)),
            format!("{:.2}", unit.convert(s.p90_ns)),
            format!("{:.2}", unit.convert(s.p95_ns)),
            format!("{:.2}", unit.convert(s.p99_ns)),
            format!("{:.2}", unit.convert(s.min_ns)),
            format!("{:.2}", unit.convert(s.max_ns)),
            vs,
        ]);
    }

    // Column widths
    let mut widths: Vec<usize> = header.iter().map(|h| h.len()).collect();
    for row in &rows {
        for (i, cell) in row.iter().enumerate() {
            widths[i] = widths[i].max(cell.len());
        }
    }

    // Header row
    write!(out, "|").unwrap();
    for (i, h) in header.iter().enumerate() {
        write!(out, " {:<w$} |", h, w = widths[i]).unwrap();
    }
    write!(out, "\n|").unwrap();

    // Separator
    for w in &widths {
        write!(out, " {} |", "-".repeat(*w)).unwrap();
    }
    write!(out, "\n").unwrap();

    // Data rows
    for row in &rows {
        write!(out, "|").unwrap();
        for (i, cell) in row.iter().enumerate() {
            if i == 0 {
                write!(out, " {:<w$} |", cell, w = widths[i]).unwrap();
            } else {
                write!(out, " {:>w$} |", cell, w = widths[i]).unwrap();
            }
        }
        write!(out, "\n").unwrap();
    }

    out
}

#[allow(clippy::unwrap_used)] // write! to String is infallible
fn format_suite_markdown(suite: &BenchSuiteResult) -> String {
    let mut md = String::new();

    writeln!(md, "# BLAKE3 Benchmark \u{2014} {}", suite.runtime).unwrap();
    writeln!(md).unwrap();
    writeln!(md, "**Date:** {}", suite.timestamp).unwrap();
    writeln!(md).unwrap();

    let mut current_section = "";
    for group in &suite.groups {
        let section = get_bench_section(&group.name);
        if section != current_section {
            current_section = section;
            writeln!(md, "## {}", section_header(section)).unwrap();
            writeln!(md).unwrap();
        }

        // Detect time unit per group so small/large sizes use appropriate units
        let means: Vec<f64> = group.results.iter().map(|r| r.stats.mean_ns).collect();
        let unit = TimeUnit::detect(&means);

        writeln!(md, "### {}", group.name).unwrap();
        writeln!(md).unwrap();
        md.push_str(&format_group_markdown(group, &unit));
        writeln!(md).unwrap();
    }

    if !suite.wasm_sizes.is_empty() {
        writeln!(md, "## WASM Binary Sizes").unwrap();
        writeln!(md).unwrap();
        writeln!(md, "| Binary | Size |").unwrap();
        writeln!(md, "| --- | ---: |").unwrap();
        for ws in &suite.wasm_sizes {
            let kb = ws.bytes as f64 / 1024.0;
            writeln!(md, "| {} | {kb:.1} KB |", ws.label).unwrap();
        }
        writeln!(md).unwrap();
    }

    md
}

// ── Correctness comparison ────────────────────────────────────────────────────

fn run_compare(engine: &wasmtime::Engine, linker: &wasmtime::component::Linker<HostState>) {
    let wasm_path = "pkg/component/blake3_component.wasm";
    let path = Path::new(wasm_path);
    assert!(
        path.exists(),
        "Component not built: {wasm_path}\nRun: deno task build:component"
    );

    let component = wasmtime::component::Component::from_file(engine, path)
        .unwrap_or_else(|e| panic!("Failed to load {wasm_path}: {e}"));
    let mut store = new_store(engine);
    let instance = Blake3::instantiate(&mut store, &component, linker)
        .unwrap_or_else(|e| panic!("Failed to instantiate component: {e}"));
    let hashing = instance.fuzdev_blake3_hashing();

    let vectors_json = std::fs::read_to_string("test/test_vectors.json")
        .unwrap_or_else(|e| panic!("Failed to read test/test_vectors.json: {e}"));
    let vectors: Vec<TestVector> = serde_json::from_str(&vectors_json)
        .unwrap_or_else(|e| panic!("Failed to parse test/test_vectors.json: {e}"));

    let mut passed: u32 = 0;
    let mut failed: u32 = 0;

    let mut check = |label: &str, actual: &str, expected: &str| {
        if actual == expected {
            eprintln!("  PASS: {label}");
            passed += 1;
        } else {
            eprintln!("  FAIL: {label}");
            eprintln!("    expected: {expected}");
            eprintln!("    actual:   {actual}");
            failed += 1;
        }
    };

    // One-shot hash
    eprintln!("=== One-shot hash ===");
    for v in &vectors {
        let input = hex_to_bytes(&v.input_hex);
        let result = hashing
            .call_hash(&mut store, &input)
            .unwrap_or_else(|e| panic!("call_hash failed: {e}"));
        check(&format!("hash({})", v.label), &to_hex(&result), &v.hash);
    }

    // Keyed hash
    eprintln!();
    eprintln!("=== Keyed hash ===");
    for v in &vectors {
        let input = hex_to_bytes(&v.input_hex);
        let key = hex_to_bytes(&v.keyed_hash_key_hex);
        let result = hashing
            .call_keyed_hash(&mut store, &key, &input)
            .unwrap_or_else(|e| panic!("call_keyed_hash failed: {e}"))
            .unwrap_or_else(|e| panic!("keyed_hash returned error: {e:?}"));
        check(
            &format!("keyed_hash({})", v.label),
            &to_hex(&result),
            &v.keyed_hash,
        );
    }

    // Derive key
    eprintln!();
    eprintln!("=== Derive key ===");
    for v in &vectors {
        let input = hex_to_bytes(&v.input_hex);
        let result = hashing
            .call_derive_key(&mut store, &v.derive_key_context, &input)
            .unwrap_or_else(|e| panic!("call_derive_key failed: {e}"));
        check(
            &format!("derive_key({})", v.label),
            &to_hex(&result),
            &v.derive_key,
        );
    }

    // Streaming hasher — single chunk should match one-shot
    eprintln!();
    eprintln!("=== Streaming hasher ===");
    for v in &vectors {
        let input = hex_to_bytes(&v.input_hex);
        let hasher = hashing
            .hasher()
            .call_constructor(&mut store)
            .unwrap_or_else(|e| panic!("constructor failed: {e}"));
        hashing
            .hasher()
            .call_update(&mut store, hasher, &input)
            .unwrap_or_else(|e| panic!("update failed: {e}"));
        let result = hashing
            .hasher()
            .call_finalize(&mut store, hasher)
            .unwrap_or_else(|e| panic!("finalize failed: {e}"));
        check(
            &format!("streaming({})", v.label),
            &to_hex(&result),
            &v.hash,
        );
        hasher
            .resource_drop(&mut store)
            .unwrap_or_else(|e| panic!("drop failed: {e}"));
    }

    // Keyed streaming
    eprintln!();
    eprintln!("=== Keyed streaming ===");
    for v in &vectors {
        let input = hex_to_bytes(&v.input_hex);
        let key = hex_to_bytes(&v.keyed_hash_key_hex);
        let hasher = hashing
            .hasher()
            .call_new_keyed(&mut store, &key)
            .unwrap_or_else(|e| panic!("call_new_keyed failed: {e}"))
            .unwrap_or_else(|e| panic!("new_keyed returned error: {e:?}"));
        hashing
            .hasher()
            .call_update(&mut store, hasher, &input)
            .unwrap_or_else(|e| panic!("update failed: {e}"));
        let result = hashing
            .hasher()
            .call_finalize(&mut store, hasher)
            .unwrap_or_else(|e| panic!("finalize failed: {e}"));
        check(
            &format!("keyed streaming({})", v.label),
            &to_hex(&result),
            &v.keyed_hash,
        );
        hasher
            .resource_drop(&mut store)
            .unwrap_or_else(|e| panic!("drop failed: {e}"));
    }

    // Derive key streaming
    eprintln!();
    eprintln!("=== Derive key streaming ===");
    for v in &vectors {
        let input = hex_to_bytes(&v.input_hex);
        let hasher = hashing
            .hasher()
            .call_new_derive_key(&mut store, &v.derive_key_context)
            .unwrap_or_else(|e| panic!("call_new_derive_key failed: {e}"));
        hashing
            .hasher()
            .call_update(&mut store, hasher, &input)
            .unwrap_or_else(|e| panic!("update failed: {e}"));
        let result = hashing
            .hasher()
            .call_finalize(&mut store, hasher)
            .unwrap_or_else(|e| panic!("finalize failed: {e}"));
        check(
            &format!("derive_key streaming({})", v.label),
            &to_hex(&result),
            &v.derive_key,
        );
        hasher
            .resource_drop(&mut store)
            .unwrap_or_else(|e| panic!("drop failed: {e}"));
    }

    // finalize_and_reset
    eprintln!();
    eprintln!("=== finalize_and_reset ===");
    {
        let v = &vectors[1]; // "hello" vector
        let input = hex_to_bytes(&v.input_hex);
        let hasher = hashing
            .hasher()
            .call_constructor(&mut store)
            .unwrap_or_else(|e| panic!("constructor failed: {e}"));
        hashing
            .hasher()
            .call_update(&mut store, hasher, &input)
            .unwrap_or_else(|e| panic!("update failed: {e}"));
        let result = hashing
            .hasher()
            .call_finalize_and_reset(&mut store, hasher)
            .unwrap_or_else(|e| panic!("finalize_and_reset failed: {e}"));
        check("finalize_and_reset == hash", &to_hex(&result), &v.hash);

        // After reset, should produce fresh hash
        let world = b"world";
        hashing
            .hasher()
            .call_update(&mut store, hasher, world)
            .unwrap_or_else(|e| panic!("update failed: {e}"));
        let result2 = hashing
            .hasher()
            .call_finalize(&mut store, hasher)
            .unwrap_or_else(|e| panic!("finalize failed: {e}"));
        let expected = hashing
            .call_hash(&mut store, world)
            .unwrap_or_else(|e| panic!("call_hash failed: {e}"));
        check(
            "after finalize_and_reset, hasher is fresh",
            &to_hex(&result2),
            &to_hex(&expected),
        );
        hasher
            .resource_drop(&mut store)
            .unwrap_or_else(|e| panic!("drop failed: {e}"));
    }

    // Error paths — invalid key length
    eprintln!();
    eprintln!("=== Error paths ===");

    // keyed_hash with 16-byte key
    let bad_key = vec![0x01_u8; 16];
    let result = hashing
        .call_keyed_hash(&mut store, &bad_key, &[0u8])
        .unwrap_or_else(|e| panic!("call_keyed_hash trap: {e}"));
    if result.is_err() {
        eprintln!("  PASS: keyed_hash(16-byte key) returns error");
        passed += 1;
    } else {
        eprintln!("  FAIL: keyed_hash(16-byte key) should return error");
        failed += 1;
    }

    // new_keyed with 0-byte key
    let result = hashing
        .hasher()
        .call_new_keyed(&mut store, &[])
        .unwrap_or_else(|e| panic!("call_new_keyed trap: {e}"));
    if result.is_err() {
        eprintln!("  PASS: new_keyed(empty key) returns error");
        passed += 1;
    } else {
        // Clean up the hasher if it somehow succeeded
        if let Ok(hasher) = result {
            let _ = hasher.resource_drop(&mut store);
        }
        eprintln!("  FAIL: new_keyed(empty key) should return error");
        failed += 1;
    }

    // Summary
    eprintln!();
    eprintln!("=== Results: {passed} passed, {failed} failed ===");
    if failed > 0 {
        std::process::exit(1);
    }
}

// ── Main ─────────────────────────────────────────────────────────────────────

fn main() {
    let engine = wasmtime::Engine::new(wasmtime::Config::new().wasm_component_model(true))
        .unwrap_or_else(|e| panic!("Failed to create engine: {e}"));
    let linker = new_linker(&engine);

    // --compare mode: correctness verification instead of benchmarks
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--compare") {
        eprintln!("BLAKE3 Component Model — Correctness Comparison");
        eprintln!();
        run_compare(&engine, &linker);
        return;
    }

    let profiles = vec![ComponentProfile {
        label: "blake3_component".to_string(),
        wasm_path: "pkg/component/blake3_component.wasm".to_string(),
    }];

    eprintln!("BLAKE3 WASM Benchmark — Wasmtime (component model)");
    eprintln!();

    // Benchmark data sizes
    let sizes: Vec<(&str, Vec<u8>)> = vec![
        ("32 B", vec![0xab; 32]),
        ("1 KB", vec![0xab; 1024]),
        ("64 KB", vec![0xab; 65536]),
        ("1 MB", vec![0xab; 1_048_576]),
    ];

    let mut groups = Vec::new();

    // Hash benchmarks at various sizes
    for (label, data) in &sizes {
        eprintln!("--- hash ({label}) ---");
        groups.push(bench_one_shot(
            &engine,
            &linker,
            &profiles,
            format!("hash ({label})"),
            data.len() as u64,
            |instance, store| {
                let _ = instance.fuzdev_blake3_hashing().call_hash(store, data);
            },
        ));
        eprintln!();
    }

    // Keyed hash benchmarks
    let key = vec![0x01_u8; 32];
    for (label, data) in &sizes {
        eprintln!("--- keyed_hash ({label}) ---");
        groups.push(bench_one_shot(
            &engine,
            &linker,
            &profiles,
            format!("keyed_hash ({label})"),
            data.len() as u64,
            |instance, store| {
                let _ = instance
                    .fuzdev_blake3_hashing()
                    .call_keyed_hash(store, &key, data);
            },
        ));
        eprintln!();
    }

    // Derive key benchmarks
    for (label, data) in &sizes {
        eprintln!("--- derive_key ({label}) ---");
        groups.push(bench_one_shot(
            &engine,
            &linker,
            &profiles,
            format!("derive_key ({label})"),
            data.len() as u64,
            |instance, store| {
                let _ = instance.fuzdev_blake3_hashing().call_derive_key(
                    store,
                    "blake3-wasm-bench 2024",
                    data,
                );
            },
        ));
        eprintln!();
    }

    // Streaming benchmarks — same sizes as TS bench_core.ts
    // Pre-allocate the largest buffer once; slice for smaller sizes.
    let streaming_buf = vec![0xab_u8; 1_048_576];
    let streaming_sizes: &[(&str, usize, usize)] = &[
        ("1 KB", 1024, 64),
        ("64 KB", 65536, 8192),
        ("1 MB", 1_048_576, 8192),
    ];
    for &(label, data_bytes, chunk_size) in streaming_sizes {
        let chunk_label = if chunk_size >= 1024 {
            format!("{} KB chunks", chunk_size / 1024)
        } else {
            format!("{chunk_size} B chunks")
        };
        eprintln!("--- streaming ({label}, {chunk_label}) ---");
        groups.push(bench_streaming(
            &engine,
            &linker,
            &profiles,
            label,
            &streaming_buf[..data_bytes],
            chunk_size,
        ));
        eprintln!();
    }

    // Summary
    eprintln!("{}", "=".repeat(60));
    eprintln!("SUMMARY");
    eprintln!("{}", "=".repeat(60));
    eprintln!();

    let all_means: Vec<f64> = groups
        .iter()
        .flat_map(|g| g.results.iter().map(|r| r.stats.mean_ns))
        .collect();
    let summary_unit = TimeUnit::detect(&all_means);

    let mut current_section = "";
    for group in &groups {
        let section = get_bench_section(&group.name);
        if section != current_section {
            current_section = section;
            eprintln!("{}", section_header(section));
            eprintln!();
        }

        eprintln!("{}:", group.name);
        let best_ops = group
            .results
            .iter()
            .map(|r| r.stats.ops_per_second)
            .fold(0.0_f64, f64::max);
        for result in &group.results {
            let time_val = summary_unit.convert(result.stats.mean_ns);
            let time_str = format!("{time_val:.2} {}", summary_unit.label());
            let ci = result.stats.confidence_interval_ns;
            let ci_margin = (ci.1 - ci.0) / 2.0;
            let ci_str = format!(
                " \u{b1}{:.1} {}",
                summary_unit.convert(ci_margin),
                summary_unit.label()
            );
            let throughput = group
                .data_bytes
                .map(|db| format_throughput(result.stats.ops_per_second, db))
                .unwrap_or_default();
            let ratio_str = if best_ops > 0.0 {
                let ratio = best_ops / result.stats.ops_per_second;
                if ratio > 1.05 {
                    format!("  {ratio:.1}x")
                } else {
                    "  1.0x".to_string()
                }
            } else {
                String::new()
            };
            if !throughput.is_empty() {
                eprintln!(
                    "  {:<28} {:>12}  {:>12}{}{}",
                    result.name, throughput, time_str, ci_str, ratio_str,
                );
            } else {
                eprintln!(
                    "  {:<28} {:>12}{}{}",
                    result.name, time_str, ci_str, ratio_str,
                );
            }
        }
        eprintln!();
    }

    // WASM sizes
    eprintln!("WASM BINARY SIZES:");
    let mut wasm_sizes = Vec::new();
    for profile in &profiles {
        let path = Path::new(&profile.wasm_path);
        if let Ok(metadata) = std::fs::metadata(path) {
            let bytes = metadata.len();
            let kb = bytes as f64 / 1024.0;
            eprintln!("  {:<28} {:>8} bytes  ({kb:.1} KB)", profile.label, bytes);
            wasm_sizes.push(WasmSize {
                label: profile.label.clone(),
                bytes,
            });
        }
    }

    // Build result
    let timestamp = chrono_free_timestamp();
    let runner_categories: HashMap<String, String> = profiles
        .iter()
        .map(|p| (p.label.clone(), "blake3".to_string()))
        .collect();
    let suite_result = BenchSuiteResult {
        runtime: "Wasmtime".to_string(),
        timestamp: timestamp.clone(),
        groups,
        wasm_sizes,
        runner_categories,
    };

    // Write results
    let results_dir = Path::new("benches/results");
    std::fs::create_dir_all(results_dir)
        .unwrap_or_else(|e| panic!("Failed to create results dir: {e}"));

    let json = {
        let mut buf = Vec::new();
        let formatter = serde_json::ser::PrettyFormatter::with_indent(b"\t");
        let mut ser = serde_json::Serializer::with_formatter(&mut buf, formatter);
        suite_result
            .serialize(&mut ser)
            .unwrap_or_else(|e| panic!("Failed to serialize results: {e}"));
        String::from_utf8(buf).unwrap_or_else(|e| panic!("Failed to build JSON string: {e}"))
    };

    // Fixed-name output
    let output_path = results_dir.join("wasmtime.json");
    std::fs::write(&output_path, &json)
        .unwrap_or_else(|e| panic!("Failed to write {}: {e}", output_path.display()));

    // Timestamped history
    let ts = timestamp.replace([':', '.'], "-");
    let ts = &ts[..19.min(ts.len())];
    let commit = std::process::Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| format!("_{}", s.trim()))
        .unwrap_or_default();
    let base_path = results_dir.join(format!("{ts}_wasmtime{commit}"));
    let history_json = format!("{}.json", base_path.display());
    std::fs::write(&history_json, &json)
        .unwrap_or_else(|e| panic!("Failed to write {history_json}: {e}"));

    // Markdown history
    let markdown = format_suite_markdown(&suite_result);
    let history_md = format!("{}.md", base_path.display());
    std::fs::write(&history_md, &markdown)
        .unwrap_or_else(|e| panic!("Failed to write {history_md}: {e}"));

    eprintln!();
    eprintln!("Results written to {}", output_path.display());
    eprintln!("History saved to {}.{{json,md}}", base_path.display());
}

/// ISO 8601 timestamp without chrono dependency.
fn chrono_free_timestamp() -> String {
    let now = std::time::SystemTime::now();
    let duration = now
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs();

    // Manual UTC decomposition (no leap seconds)
    let days = secs / 86400;
    let time_secs = secs % 86400;
    let hours = time_secs / 3600;
    let minutes = (time_secs % 3600) / 60;
    let seconds = time_secs % 60;

    // Days since epoch to Y-M-D
    // Algorithm: Howard Hinnant, "chrono-Compatible Low-Level Date Algorithms"
    // https://howardhinnant.github.io/date_algorithms.html#civil_from_days
    let z = days as i64 + 719_468;
    let era = z / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };

    format!("{y:04}-{m:02}-{d:02}T{hours:02}:{minutes:02}:{seconds:02}.000Z")
}
