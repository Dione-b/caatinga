pragma circom 2.1.6;

template Main() {
    signal input a;
    signal output b;
    b <== a;
}

component main = Main();
