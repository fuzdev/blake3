use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();
    let command = args.get(1).map(String::as_str);

    match command {
        Some("hash") => cmd_hash(&args[2..]),
        Some("test-vectors") => cmd_test_vectors(),
        _ => print_usage(),
    }
}

fn print_usage() {
    eprintln!("Usage: blake3_debug <command>");
    eprintln!();
    eprintln!("Commands:");
    eprintln!("  hash <hex_input>    Hash hex-encoded input with native blake3");
    eprintln!("  test-vectors        Print JSON test vectors for Deno comparison script");
}

/// Hash hex-encoded input data and print the result.
fn cmd_hash(args: &[String]) {
    let Some(hex_input) = args.first() else {
        eprintln!("Usage: blake3_debug hash <hex_input>");
        eprintln!("  Use 'text:hello' to hash a text string directly");
        std::process::exit(1);
    };

    #[allow(clippy::option_if_let_else)]
    let data = if let Some(text) = hex_input.strip_prefix("text:") {
        text.as_bytes().to_vec()
    } else {
        match hex_decode(hex_input) {
            Ok(d) => d,
            Err(e) => {
                eprintln!("Invalid hex input: {e}");
                std::process::exit(1);
            }
        }
    };

    let hash = blake3::hash(&data);
    println!("{}", hash.to_hex());
}

/// The official BLAKE3 test-vector key: 32 ASCII bytes.
const VECTOR_KEY: &[u8; 32] = b"whats the Elvish word for friend";

/// The official BLAKE3 test-vector `derive_key` context.
const VECTOR_CONTEXT: &str = "BLAKE3 2019-12-27 16:29:52 test vectors context";

/// Input lengths around the block (64-byte) and chunk (1024-byte)
/// boundaries, where the tree mode changes shape, plus a 64 KiB input past
/// the SIMD batch widths.
const VECTOR_LENGTHS: &[usize] = &[
    0, 1, 63, 64, 65, 1023, 1024, 1025, 2048, 2049, 3072, 3073, 4096, 4097, 8192, 8193, 31744,
    31745, 65536,
];

/// The official BLAKE3 test-vector input: byte `i` is `i % 251`. The cycle
/// is prime, so neighboring blocks and chunks never repeat each other.
fn vector_input(len: usize) -> Vec<u8> {
    #[allow(clippy::cast_possible_truncation)]
    (0..len).map(|i| (i % 251) as u8).collect()
}

/// Print JSON test vectors for the Deno comparison script.
///
/// Outputs come from the native `blake3` crate. The patterned inputs use the
/// official BLAKE3 test-vector convention (input, key, and context), so a
/// patterned entry's digests are the first 32 bytes of the official vector's
/// extended outputs at the lengths the official set covers.
fn cmd_test_vectors() {
    let mut test_inputs: Vec<(String, Vec<u8>)> = vec![
        ("hello".to_owned(), b"hello".to_vec()),
        ("single_byte".to_owned(), vec![0x42]),
    ];
    test_inputs.extend(
        VECTOR_LENGTHS
            .iter()
            .map(|&len| (format!("pattern_{len}"), vector_input(len))),
    );

    println!("[");
    for (i, (label, data)) in test_inputs.iter().enumerate() {
        let hash = blake3::hash(data);

        let keyed = blake3::keyed_hash(VECTOR_KEY, data);
        let derived = blake3::derive_key(VECTOR_CONTEXT, data);

        let comma = if i + 1 < test_inputs.len() { "," } else { "" };
        println!("  {{");
        println!("    \"label\": \"{label}\",");
        println!("    \"input_hex\": \"{}\",", hex_encode(data));
        println!("    \"hash\": \"{}\",", hash.to_hex());
        println!("    \"keyed_hash\": \"{}\",", keyed.to_hex());
        println!(
            "    \"keyed_hash_key_hex\": \"{}\",",
            hex_encode(VECTOR_KEY)
        );
        println!("    \"derive_key\": \"{}\",", hex_encode(&derived));
        println!("    \"derive_key_context\": \"{VECTOR_CONTEXT}\"");
        println!("  }}{comma}");
    }
    println!("]");
}

fn hex_encode(data: &[u8]) -> String {
    use std::fmt::Write;
    data.iter()
        .fold(String::with_capacity(data.len() * 2), |mut s, b| {
            let _ = write!(s, "{b:02x}");
            s
        })
}

fn hex_decode(s: &str) -> Result<Vec<u8>, String> {
    if !s.len().is_multiple_of(2) {
        return Err("odd-length hex string".to_string());
    }
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).map_err(|e| e.to_string()))
        .collect()
}
