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

/// Print JSON test vectors for the Deno comparison script.
fn cmd_test_vectors() {
    let test_inputs: Vec<(&str, Vec<u8>)> = vec![
        ("empty", vec![]),
        ("hello", b"hello".to_vec()),
        ("single_byte", vec![0x42]),
        ("1kb", vec![0xAB; 1024]),
        ("64kb", vec![0xCD; 65536]),
    ];

    println!("[");
    for (i, (label, data)) in test_inputs.iter().enumerate() {
        let hash = blake3::hash(data);

        // Keyed hash with a known key
        let key = [0x01u8; 32];
        let keyed = blake3::keyed_hash(&key, data);

        // Derive key
        let derived = blake3::derive_key("blake3-wasm-test 2024", data);

        let comma = if i + 1 < test_inputs.len() { "," } else { "" };
        println!("  {{");
        println!("    \"label\": \"{label}\",");
        println!("    \"input_hex\": \"{}\",", hex_encode(data));
        println!("    \"hash\": \"{}\",", hash.to_hex());
        println!("    \"keyed_hash\": \"{}\",", keyed.to_hex());
        println!("    \"keyed_hash_key_hex\": \"{}\",", hex_encode(&key));
        println!("    \"derive_key\": \"{}\",", hex_encode(&derived));
        println!("    \"derive_key_context\": \"blake3-wasm-test 2024\"");
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
