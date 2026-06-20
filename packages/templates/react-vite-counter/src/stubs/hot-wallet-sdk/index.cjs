"use strict";

exports.HOT = {
  request() {
    return Promise.reject(new Error("HOT Wallet is not supported in this build."));
  },
};
