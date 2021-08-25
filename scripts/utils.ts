// helper functions

export function expandStr(str: String, len: number) {
  let s = str;
  while(s.length < len) s = `${s} `
  return s;
}

export function logContractAddress(contractName: String, address: String) {
  console.log(`${expandStr(contractName,16)} | ${address}`)
}
