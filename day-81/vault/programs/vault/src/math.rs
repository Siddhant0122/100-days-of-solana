// Returns the new balance, or None if the deposit would overflow u64.
pub fn apply_deposit(balance: u64, amount: u64) -> Option<u64> {
    balance.checked_add(amount)
}

#[cfg(test)]
mod tests {
    use super::apply_deposit;
    use proptest::prelude::*;

    proptest! {
        // proptest runs this hundreds of times with generated u64 pairs.
        #[test]
        fn deposit_never_shrinks_a_balance(balance in any::<u64>(), amount in any::<u64>()) {
            match apply_deposit(balance, amount) {
                // If it succeeded, the new balance must be at least the old one.
                Some(new_balance) => prop_assert!(new_balance >= balance),
                // If it returned None, the real sum must genuinely overflow.
                None => prop_assert!(balance.checked_add(amount).is_none()),
            }
        }
    }
}
