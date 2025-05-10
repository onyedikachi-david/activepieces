import { HttpMessageBody, HttpMethod, QueryParams, httpClient } from "@activepieces/pieces-common";
import { StaticPropsValue } from "@activepieces/pieces-framework";
import { zagomailAuth } from "../index";

type ZagomailAuthProps = StaticPropsValue<typeof zagomailAuth["props"]>;

export interface ZagomailApiResponse<T = unknown> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  error?: string | Record<string, unknown> | unknown;
}

export class ZagomailClient {
  private readonly API_URL = 'https://api.zagomail.com';
  private PUBLIC_KEY: string;
  // privateKey is part of auth but not used in these data plane calls as per current understanding

  constructor(auth: ZagomailAuthProps) {
    // this.API_URL = auth.apiUrl.endsWith('/') ? auth.apiUrl.slice(0, -1) : auth.apiUrl;
    this.PUBLIC_KEY = auth.publicKey;
    // this.PRIVATE_KEY = auth.privateKey; // Not used for now
  }

  getPublicKey(): string {
    return this.PUBLIC_KEY;
  }

  async makeRequest<T extends HttpMessageBody = Record<string, unknown>>(
    method: HttpMethod,
    endpoint: string,
    query?: QueryParams,
    body?: HttpMessageBody
  ): Promise<ZagomailApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    try {
      const response = await httpClient.sendRequest<ZagomailApiResponse<T>>({
        method: method,
        url: `${this.API_URL}/${endpoint.startsWith('/') ? endpoint.substring(1) : endpoint}`,
        headers: headers,
        queryParams: query,
        body: body,
      });

      // Zagomail API returns 200 OK even for logical errors like "subscriber not found",
      // with status: "error" in the body.
      if (response.body && (response.body.status === 'success' || response.body.status === 'error')) {
        if (response.body.status === 'success') {
            return response.body;
        }
        // If status is 'error', we still return the body for the caller to inspect,
        // but throw an error that includes the message from the API.
        // This allows testAuth to check for specific error messages.
        let errorMessage = `Zagomail API Error: ${response.body.error || response.body.message || 'Operation failed with status: error'}`;
        if (typeof response.body.error === 'object' && response.body.error !== null) {
            errorMessage = `Zagomail API Error: ${JSON.stringify(response.body.error)}`;
        } else if (response.body.error) {
            errorMessage = `Zagomail API Error: ${response.body.error}`;
        } else if (response.body.message) {
            errorMessage = `Zagomail API Error (from message field): ${response.body.message}`;
        }
        // We throw here so that standard action calls treat status:error as a failure.
        // testAuth will catch this and inspect it.
        throw new Error(errorMessage);

      } else {
        throw new Error('Zagomail API Error: Unexpected response structure or missing status.');
      }
    } catch (error) {
        // This catches errors from httpClient.sendRequest (network, non-2xx outside of Zagomail's 200 OK for errors)
        // or errors thrown from the block above (e.g. unexpected structure, or explicit throw for status:error)
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      // Avoid duplicating "Zagomail API Error:" if already present
      if (message.startsWith('Zagomail API Error:')) {
        throw new Error(message);
      }
      throw new Error(`Zagomail API Request Failed: ${message}`);
    }
  }

  async testAuth(): Promise<{ valid: boolean; error?: string }> {
    // Using "Get All Lists" endpoint for testing.
    // Docs: GET /lists/all-lists, body {publicKey}.
    // Success should be { status: "success", data: { ... } }
    const requestBody = {
      publicKey: this.getPublicKey(),
    };

    try {
      const response = await this.makeRequest<{
        count?: string | number | null;
        total_pages?: number | null;
        current_page?: number | null;
        records?: unknown[];
      }>(
        HttpMethod.GET,
        'lists/all-lists',
        undefined,
        requestBody
      );

      // If makeRequest returns, it means status was 'success'.
      // The presence of response.data (even if records array is empty) indicates success.
      if (response.data) {
        return { valid: true };
      }
      // This case should ideally not be reached if makeRequest ensures status:success means data is present,
      // or if the API always returns a data object on success for this endpoint.
      return { valid: false, error: 'Authentication test (get all lists) succeeded but no data object in response.' };

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error during authentication test (get all lists).';
        // Any error here (404, 401, 403, specific error messages like "No account found", etc.) is a failure for auth test.
        return { valid: false, error: `Authentication test failed (get all lists): ${errorMessage}` };
    }
  }

  async getAllLists(): Promise<Array<{ name: string; uid: string }>> {
    const requestBody = { publicKey: this.getPublicKey() };
    try {
      const response = await this.makeRequest<{
        records?: Array<{
          general: {
            list_uid: string;
            name: string;
            display_name?: string;
            description?: string;
          };
          // ... other properties we don't need for this method
        }>;
        // ... other top-level response properties like count, total_pages etc.
      }>(
        HttpMethod.GET,
        'lists/all-lists',
        undefined,
        requestBody
      );

      if (response.data && Array.isArray(response.data.records)) {
        return response.data.records.map(record => ({
          name: record.general.name || record.general.display_name || record.general.list_uid, // Fallback if name is empty
          uid: record.general.list_uid,
        }));
      }
      return []; // Return empty if no records or unexpected structure
    } catch (error) {
      // Log the error or handle it as appropriate for your piece
      // For now, rethrow to be caught by the calling prop options function
      console.error("Error fetching Zagomail lists:", error);
      throw new Error(`Failed to fetch Zagomail lists: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    }
  }
}

export function makeZagomailClient(auth: ZagomailAuthProps): ZagomailClient {
  return new ZagomailClient(auth);
}
