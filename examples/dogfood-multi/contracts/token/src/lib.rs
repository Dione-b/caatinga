#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Env};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Supply,
}

#[contract]
pub struct TokenContract;

#[contractimpl]
impl TokenContract {
    pub fn supply(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::Supply).unwrap_or(0)
    }

    pub fn mint(env: Env, amount: u64) -> u64 {
        let current = Self::supply(env.clone());
        let next = current.saturating_add(amount);
        env.storage().instance().set(&DataKey::Supply, &next);
        next
    }
}
