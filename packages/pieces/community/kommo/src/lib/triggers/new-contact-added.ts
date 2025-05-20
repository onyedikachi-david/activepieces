import { OAuth2PropertyValue, StoreScope, TriggerStrategy, createTrigger } from '@activepieces/pieces-framework';
import { httpClient, HttpMethod, AuthenticationType, HttpRequest } from '@activepieces/pieces-common';

const KOMMO_NEW_CONTACT_WEBHOOK_ID_STORE_KEY = 'kommo_new_contact_webhook_id';
const KOMMO_NEW_CONTACT_WEBHOOK_DESTINATION_STORE_KEY = 'kommo_new_contact_webhook_destination';

export const kommoNewContactAdded = createTrigger({
    name: 'new_contact_added',
    displayName: 'New Contact Added',
    description: 'Triggers when a contact is added to Kommo.',
    props: {},
    type: TriggerStrategy.WEBHOOK,
    sampleData: {
        "contacts": [
            {
                "id": 67890,
                "name": "New Contact via Webhook",
                "first_name": "John",
                "last_name": "Doe",
                "created_at": 1678886600,
            }
        ]
    },
    async onEnable(context) {
        const { store, auth, webhookUrl } = context;
        const { access_token, props } = auth as OAuth2PropertyValue;
        const accountSubdomain = props?.['account_subdomain'];

        if (!accountSubdomain) {
            throw new Error("Account subdomain is missing from connection.");
        }

        const requestBody = {
            destination: webhookUrl,
            settings: ['add_contact']
        };

        const request: HttpRequest = {
            method: HttpMethod.POST,
            url: `https://${accountSubdomain}.kommo.com/api/v4/webhooks`,
            body: requestBody,
            authentication: {
                type: AuthenticationType.BEARER_TOKEN,
                token: access_token,
            },
            headers: { 'Content-Type': 'application/json' },
        };

        const response = await httpClient.sendRequest<{ id: string }>(request);

        if (response.status === 200 && response.body?.id) {
            await store.put(KOMMO_NEW_CONTACT_WEBHOOK_ID_STORE_KEY, response.body.id, StoreScope.FLOW);
            await store.put(KOMMO_NEW_CONTACT_WEBHOOK_DESTINATION_STORE_KEY, webhookUrl, StoreScope.FLOW);
            console.log(`Kommo webhook created for New Contact Added: ${response.body.id}, listening to ${webhookUrl}`);
        } else {
            console.error('Failed to create Kommo webhook for New Contact Added', response);
            throw new Error(`Failed to create Kommo webhook. Status: ${response.status}, Body: ${JSON.stringify(response.body)}`);
        }
    },
    async onDisable(context) {
        const { store, auth } = context;
        const { access_token, props } = auth as OAuth2PropertyValue;
        const accountSubdomain = props?.['account_subdomain'];
        const registeredWebhookUrl = await store.get<string>(KOMMO_NEW_CONTACT_WEBHOOK_DESTINATION_STORE_KEY, StoreScope.FLOW);

        if (accountSubdomain && registeredWebhookUrl) {
            const requestBody = {
                destination: registeredWebhookUrl
            };
            const request: HttpRequest = {
                method: HttpMethod.DELETE,
                url: `https://${accountSubdomain}.kommo.com/api/v4/webhooks`,
                body: requestBody,
                authentication: {
                    type: AuthenticationType.BEARER_TOKEN,
                    token: access_token,
                },
                headers: { 'Content-Type': 'application/json' },
            };
            try {
                const response = await httpClient.sendRequest(request);
                if (response.status === 204) {
                    console.log(`Kommo webhook for destination ${registeredWebhookUrl} (New Contact Added) deleted successfully.`);
                } else {
                    console.warn(`Failed to delete Kommo webhook for ${registeredWebhookUrl} (New Contact Added). Status: ${response.status}, Body: ${JSON.stringify(response.body)}`);
                }
            } catch (error) {
                console.warn(`Error deleting Kommo webhook for ${registeredWebhookUrl} (New Contact Added):`, error);
            }
        }
        await store.delete(KOMMO_NEW_CONTACT_WEBHOOK_ID_STORE_KEY, StoreScope.FLOW);
        await store.delete(KOMMO_NEW_CONTACT_WEBHOOK_DESTINATION_STORE_KEY, StoreScope.FLOW);
    },
    async run(context) {
        const payloadBody = context.payload.body;
        let newContacts: unknown[] = [];

        if (payloadBody && typeof payloadBody === 'object') {
            if ('contacts' in payloadBody) {
                const contactsData = (payloadBody as any).contacts;
                if (contactsData && typeof contactsData === 'object' && 'add' in contactsData && Array.isArray(contactsData.add)) {
                    newContacts = contactsData.add;
                } else if (Array.isArray(contactsData)) {
                    newContacts = contactsData;
                }
            } else if (Array.isArray(payloadBody)) {
                 newContacts = payloadBody;
            }
        }

        if (newContacts.length > 0) {
            console.log(`Received ${newContacts.length} new contact(s) via Kommo webhook.`);
        }
        return newContacts;
    },
});
