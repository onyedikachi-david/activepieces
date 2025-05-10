import { TriggerStrategy, createTrigger } from "@activepieces/pieces-framework";
import { HttpMethod } from "@activepieces/pieces-common";
import { zagomailAuth } from "../../index";
import { makeZagomailClient } from "../common";

interface ZagomailWebhookPayload {
    event_type: string;
    subscriber?: {
        subscriber_uid: string;
        email: string;
        fname?: string;
        lname?: string;
    };
    timestamp?: string;
}

export const newSubscriberTrigger = createTrigger({
    auth: zagomailAuth,
    name: 'new_subscriber_added',
    displayName: 'New Subscriber Added',
    description: 'Triggers when a new subscriber is activated (signed up or confirmed).',
    props: {},
    sampleData: {
        event_type: 'subscriber-activate',
        subscriber: {
            subscriber_uid: 'sub_123xyz',
            email: 'test@example.com',
            fname: 'Test',
            lname: 'User',
        },
        timestamp: '2023-10-27T10:00:00Z',
    },
    type: TriggerStrategy.WEBHOOK,

    async onEnable(context) {
        const client = makeZagomailClient(context.auth);
        const requestBody = {
            publicKey: client.getPublicKey(),
            event_type: 'subscriber-activate',
            target_url: context.webhookUrl,
        };

        // Define the expected raw response structure from webhooks/create endpoint
        type WebhookCreateSuccessResponse = {
            status: 'success'; // ZagomailClient.makeRequest ensures status is 'success' if it doesn't throw
            webhook: {
                id: string;
                event_type?: string;
                target_url?: string;
            };
            // Other potential top-level fields from Zagomail like 'message' are not strictly typed here
            // but won't cause issues for accessing 'webhook.id'.
        };

        try {
            // The generic type for makeRequest<T> refers to the type of the 'data' field in ZagomailApiResponse<T>.
            // Since the webhooks/create endpoint does not use a 'data' field to wrap the 'webhook' object,
            // we use <any> here. The 'apiResponse' variable IS the direct JSON response from Zagomail.
            const apiResponse = await client.makeRequest<any>(
                HttpMethod.POST,
                'webhooks/create',
                undefined,
                requestBody
            );

            // Cast the untyped apiResponse to our known specific structure for this endpoint's success response.
            const specificResponse = apiResponse as unknown as WebhookCreateSuccessResponse;

            if (specificResponse.webhook && specificResponse.webhook.id) {
                const webhookId = specificResponse.webhook.id;
                await context.store.put('_zagomail_new_subscriber_webhook_id', webhookId);
                console.log(`Webhook created for new_subscriber_added. ID: ${webhookId}`);
            } else {
                // This block means makeRequest indicated success, but the expected 'webhook.id' was not found.
                const errorMsg = "Failed to create Zagomail webhook: The 'webhook' object or its 'id' property was missing in the API response, despite a success status.";
                console.error(errorMsg, apiResponse); // Log the entire apiResponse for diagnostics
                // Throw the full response to aid debugging if it reaches the UI or logs.
                throw new Error(`${errorMsg} Response: ${JSON.stringify(apiResponse)}`);
            }
        } catch (error) {
            // This catches errors from makeRequest (e.g., API returning status:'error', network issues)
            // or the explicit throw from the 'else' block above.
            console.error("Error creating Zagomail webhook for new_subscriber_added:", error);
            throw new Error(`Error creating Zagomail webhook: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
        }
    },

    async onDisable(context) {
        const webhookId = await context.store.get<string>('_zagomail_new_subscriber_webhook_id');
        if (webhookId) {
            const client = makeZagomailClient(context.auth);
            const requestBody = { publicKey: client.getPublicKey() };
            try {
                await client.makeRequest(
                    HttpMethod.POST,
                    `webhooks/delete?id=${webhookId}`,
                    undefined,
                    requestBody
                );
                console.log(`Webhook deleted for new_subscriber_added. ID: ${webhookId}`);
            } catch (error) {
                console.error(`Failed to delete Zagomail webhook (ID: ${webhookId}):`, error);
            }
        } else {
            console.log("No webhook ID found in store for new_subscriber_added, skipping delete.");
        }
    },

    async run(context) {
        const payload = context.payload.body as ZagomailWebhookPayload;

        if (payload && payload.event_type === 'subscriber-activate' && payload.subscriber) {
            return [payload.subscriber];
        }
        return [];
    },

    async test(context) {
        return [this.sampleData];
    }
});
