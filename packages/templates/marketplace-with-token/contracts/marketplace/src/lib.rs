#![no_std]

use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, Symbol};

const TOKEN_CONTRACT_ID: Symbol = symbol_short!("TOKEN");

#[contract]
pub struct MarketplaceContract;

#[contractimpl]
impl MarketplaceContract {
    pub fn __constructor(env: Env, token_contract_id: Address) {
        env.storage().instance().set(&TOKEN_CONTRACT_ID, &token_contract_id);
    }

    pub fn token_contract_id(env: Env) -> Address {
        env.storage().instance().get(&TOKEN_CONTRACT_ID).unwrap()
    }

    pub fn version(_env: Env) -> u32 {
        1
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn stores_token_contract_id_in_constructor() {
        let env = Env::default();
        let token_contract_id = Address::generate(&env);
        let contract_id = env.register(
            MarketplaceContract,
            MarketplaceContractArgs::__constructor(&token_contract_id),
        );
        let client = MarketplaceContractClient::new(&env, &contract_id);

        assert_eq!(client.token_contract_id(), token_contract_id);
        assert_eq!(client.version(), 1);
    }
}
