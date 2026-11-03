export function tokenCount(value: string | null | undefined) {
  return value == null
    ? "Não informado"
    : BigInt(value).toLocaleString("pt-BR");
}
