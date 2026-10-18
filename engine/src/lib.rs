mod combat;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn protocol_version() -> u32 { 1 }

/// Numeric batch ABI v1: eight f64s per hit. No player IDs, RNG, saves, or rewards.
#[wasm_bindgen]
pub fn typed_damage_batch(input: &[f64]) -> Result<Vec<f64>, JsValue> {
    if input.len() % 8 != 0 || input.len() > 4096 * 8 {
        return Err(JsValue::from_str("Invalid combat batch length"));
    }
    let mut output = Vec::with_capacity(input.len() / 8);
    for hit in input.chunks_exact(8) {
        if hit.iter().any(|v| !v.is_finite() || v.abs() > 1e12)
            || !(hit[0] == 0.0 || hit[0] == 1.0 || hit[0] == 2.0) {
            return Err(JsValue::from_str("Invalid combat input"));
        }
        let damage = combat::typed_damage(hit);
        if !damage.is_finite() || damage > 9_007_199_254_740_991.0 {
            return Err(JsValue::from_str("Combat result out of range"));
        }
        output.push(damage);
    }
    Ok(output)
}
