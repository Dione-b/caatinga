#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Env};

const INSTANCE_TTL_THRESHOLD: u32 = 100;
const INSTANCE_TTL_EXTEND_TO: u32 = 518_400;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Count,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CounterError {
    Overflow = 1,
}

#[contract]
pub struct CounterContract;

fn refresh_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND_TO);
}

#[contractimpl]
impl CounterContract {
    pub fn get(env: Env) -> u32 {
        let count = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        refresh_instance_ttl(&env);
        count
    }

    pub fn increment(env: Env) -> Result<u32, CounterError> {
        let count = Self::get(env.clone())
            .checked_add(1)
            .ok_or(CounterError::Overflow)?;

        env.storage().instance().set(&DataKey::Count, &count);
        refresh_instance_ttl(&env);

        Ok(count)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn increments_counter() {
        let env = Env::default();
        let contract_id = env.register(CounterContract, ());
        let client = CounterContractClient::new(&env, &contract_id);

        assert_eq!(client.get(), 0);
        assert_eq!(client.increment(), 1);
        assert_eq!(client.get(), 1);
    }

    #[test]
    fn get_returns_zero_before_increment() {
        let env = Env::default();
        let contract_id = env.register(CounterContract, ());
        let client = CounterContractClient::new(&env, &contract_id);

        assert_eq!(client.get(), 0);
    }

    #[test]
    fn repeated_increments_preserve_state() {
        let env = Env::default();
        let contract_id = env.register(CounterContract, ());
        let client = CounterContractClient::new(&env, &contract_id);

        assert_eq!(client.increment(), 1);
        assert_eq!(client.increment(), 2);
        assert_eq!(client.increment(), 3);
        assert_eq!(client.get(), 3);
    }

    #[test]
    fn increment_returns_overflow_error() {
        let env = Env::default();
        let contract_id = env.register(CounterContract, ());
        let client = CounterContractClient::new(&env, &contract_id);

        env.as_contract(&contract_id, || {
            env.storage().instance().set(&DataKey::Count, &u32::MAX);
        });

        assert_eq!(client.try_increment(), Err(Ok(CounterError::Overflow)));
        assert_eq!(client.get(), u32::MAX);
    }
}
