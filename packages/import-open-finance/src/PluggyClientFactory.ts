import { PluggyClient } from 'pluggy-sdk'

let singleton: PluggyClient | null = null

export function getPluggyClient(clientId: string, clientSecret: string): PluggyClient {
  if (!singleton) {
    singleton = new PluggyClient({ clientId, clientSecret })
  }
  return singleton
}

export function createConnectToken(
  clientId: string,
  clientSecret: string,
  itemId?: string,
): Promise<{ accessToken: string }> {
  return getPluggyClient(clientId, clientSecret).createConnectToken(itemId)
}

export function deletePluggyItem(
  clientId: string,
  clientSecret: string,
  itemId: string,
): Promise<void> {
  return getPluggyClient(clientId, clientSecret).deleteItem(itemId)
}
