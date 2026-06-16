#![no_std]

use soroban_sdk::{contract, contractimpl, Env, Symbol};

#[contract]
pub struct AppContract;

#[contractimpl]
impl AppContract {
    pub fn hello(env: Env) -> Symbol {
        Symbol::new(&env, "hello")
    }

    pub fn version(env: Env) -> u32 {
        let _ = env;
        1
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn returns_hello_symbol() {
        let env = Env::default();
        let contract_id = env.register(AppContract, ());
        let client = AppContractClient::new(&env, &contract_id);

        assert_eq!(client.hello(), Symbol::new(&env, "hello"));
    }

    #[test]
    fn returns_version() {
        let env = Env::default();
        let contract_id = env.register(AppContract, ());
        let client = AppContractClient::new(&env, &contract_id);

        assert_eq!(client.version(), 1);
    }
}
