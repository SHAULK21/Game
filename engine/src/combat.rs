// Preserve the TypeScript formula's order of operations and f64 precision.
// type (0 true, 1 physical, 2 elemental), power, multiplier, physical defense,
// magic defense, penetration, resistance, extra multiplier.
pub fn typed_damage(hit: &[f64]) -> f64 {
    if hit[0] == 0.0 {
        return (hit[1] * hit[2] * hit[7]).round().max(1.0);
    }
    let raw = (hit[1] * hit[2]).max(1.0);
    let defense = if hit[0] == 1.0 { (hit[3] - hit[5]).max(0.0) } else { hit[4].max(0.0) };
    let constant = if hit[0] == 1.0 { 75.0 } else { 90.0 };
    let mitigation = defense / (defense + constant);
    let resistance = hit[6].clamp(-75.0, 85.0);
    (raw * (1.0 - mitigation) * (1.0 - resistance / 100.0) * hit[7]).round().max(1.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn golden_rounding_and_defense() {
        assert_eq!(typed_damage(&[1.0,100.0,1.0,75.0,90.0,0.0,0.0,1.0]),50.0);
        assert_eq!(typed_damage(&[2.0,100.0,1.0,75.0,90.0,0.0,1000.0,1.0]),8.0);
        assert_eq!(typed_damage(&[0.0,2.5,1.0,75.0,90.0,0.0,0.0,1.0]),3.0);
    }
}
