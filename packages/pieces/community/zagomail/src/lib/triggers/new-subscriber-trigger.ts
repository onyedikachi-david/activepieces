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

        try {
            const response = await client.makeRequest<{
                webhook: {
                    id: string;
                    event_type?: string;
                    target_url?: string;
                };
            }>(
                HttpMethod.POST,
                'webhooks/create',
                undefined,
                requestBody
            );

            if (response.data && response.data.webhook && response.data.webhook.id) {
                const webhookId = response.data.webhook.id;
                await context.store.put('_zagomail_new_subscriber_webhook_id', webhookId);
                console.log(`Webhook created for new_subscriber_added. ID: ${webhookId}`);
            } else {
                let errorMsg = "Failed to create Zagomail webhook: Webhook ID or webhook object missing in response.data.";
                if (!response.data) errorMsg = "Failed to create Zagomail webhook: response.data is undefined.";
                else if (!response.data.webhook) errorMsg = "Failed to create Zagomail webhook: response.data.webhook is undefined.";
                else if (!response.data.webhook.id) errorMsg = "Failed to create Zagomail webhook: response.data.webhook.id is undefined.";
                console.error(errorMsg, response.data);
                throw new Error(errorMsg);
            }
        } catch (error) {
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
