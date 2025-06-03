private convertToApiKey(apiKeyStr: string | undefined): ApiKey | undefined {
  return apiKeyStr ? ApiKey.fromString(apiKeyStr) : undefined;
}

private convertToApiKeyString(apiKey: ApiKey | undefined): string | undefined {
  return apiKey?.getValue();
}