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
  private API_URL: string;
  private PUBLIC_KEY: string;
  // privateKey is part of auth but not used in these data plane calls as per current understanding

  constructor(auth: ZagomailAuthProps) {
    this.API_URL = auth.apiUrl.endsWith('/') ? auth.apiUrl.slice(0, -1) : auth.apiUrl;
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
    const testListUid = 'ap-test-list-uid';
    const testSubscriberUid = 'ap-test-subscriber-uid';
    const requestBody = { publicKey: this.PUBLIC_KEY };

    try {
      // Attempt to get a non-existent subscriber.
      // Zagomail returns 200 OK with status: "error" if the subscriber is not found.
      // makeRequest will throw an error if status is "error". We catch it here.
      await this.makeRequest(
        HttpMethod.GET,
        `lists/get-subscriber?list_uid=${testListUid}&subscriber_uid=${testSubscriberUid}`,
        undefined,
        requestBody
      );
      // If makeRequest didn't throw, it means status was 'success', which is unexpected for a test subscriber.
      // However, it means the API is reachable and publicKey is fine for a success response.
      return { valid: true };

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error during authentication test.';
        // Check if the error is the specific one we expect for a non-existent subscriber
        if (errorMessage.includes('The subscriber does not exist in this list') ||
            errorMessage.includes('subscriber not found') /* be a bit flexible */) {
            return { valid: true }; // This is a successful auth test
        }
        // Any other error (network, different API error, malformed URL from apiUrl) means failure
        return { valid: false, error: `Authentication test failed: ${errorMessage}` };
    }
  }
}

export function makeZagomailClient(auth: ZagomailAuthProps): ZagomailClient {
  return new ZagomailClient(auth);
}
