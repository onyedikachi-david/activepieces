import { OAuth2PropertyValue, StoreScope, TriggerStrategy, createTrigger } from '@activepieces/pieces-framework';
import { httpClient, HttpMethod, AuthenticationType, HttpRequest } from '@activepieces/pieces-common';

const KOMMO_TASK_COMPLETED_WEBHOOK_ID_STORE_KEY = 'kommo_task_completed_webhook_id';
const KOMMO_TASK_COMPLETED_WEBHOOK_DESTINATION_STORE_KEY = 'kommo_task_completed_webhook_destination';

export const kommoTaskCompleted = createTrigger({
    name: 'task_completed',
    displayName: 'Task Completed',
    description: 'Fires when a user marks a task as complete.',
    props: {
    },
    type: TriggerStrategy.WEBHOOK,
    sampleData: {
        "tasks": [
            {
                "id": 78901,
                "text": "Follow up call with new lead",
                "is_completed": true,
                "responsible_user_id": 123,
                "entity_id": 12345,
                "entity_type": "leads",
                "complete_till": 1678886700, // Task deadline
                "updated_at": 1678886700, // Timestamp of last update (completion)
                "created_at": 1678880000,
                "result": {
                    "text": "Called and discussed next steps."
                }
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
            settings: ['update_task']
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
            await store.put(KOMMO_TASK_COMPLETED_WEBHOOK_ID_STORE_KEY, response.body.id, StoreScope.FLOW);
            await store.put(KOMMO_TASK_COMPLETED_WEBHOOK_DESTINATION_STORE_KEY, webhookUrl, StoreScope.FLOW);
            console.log(`Kommo webhook created for Task Completed (update_task): ${response.body.id}, listening to ${webhookUrl}`);
        } else {
            console.error('Failed to create Kommo webhook for Task Completed (update_task)', response);
            throw new Error(`Failed to create Kommo webhook. Status: ${response.status}, Body: ${JSON.stringify(response.body)}`);
        }
    },
    async onDisable(context) {
        const { store, auth } = context;
        const { access_token, props } = auth as OAuth2PropertyValue;
        const accountSubdomain = props?.['account_subdomain'];
        const registeredWebhookUrl = await store.get<string>(KOMMO_TASK_COMPLETED_WEBHOOK_DESTINATION_STORE_KEY, StoreScope.FLOW);

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
                    console.log(`Kommo webhook for destination ${registeredWebhookUrl} (Task Completed) deleted successfully.`);
                } else {
                    console.warn(`Failed to delete Kommo webhook for ${registeredWebhookUrl} (Task Completed). Status: ${response.status}, Body: ${JSON.stringify(response.body)}`);
                }
            } catch (error) {
                console.warn(`Error deleting Kommo webhook for ${registeredWebhookUrl} (Task Completed):`, error);
            }
        }
        await store.delete(KOMMO_TASK_COMPLETED_WEBHOOK_ID_STORE_KEY, StoreScope.FLOW);
        await store.delete(KOMMO_TASK_COMPLETED_WEBHOOK_DESTINATION_STORE_KEY, StoreScope.FLOW);
    },
    async run(context) {
        const payloadBody = context.payload.body;
        let updatedTasksRaw: unknown[] = [];


        if (payloadBody && typeof payloadBody === 'object') {
            if ('tasks' in payloadBody) {
                const tasksData = (payloadBody as any).tasks;
                if (tasksData && typeof tasksData === 'object') {
                    if ('update' in tasksData && Array.isArray(tasksData.update)) {
                        updatedTasksRaw = tasksData.update;
                    } else if ('status' in tasksData && Array.isArray(tasksData.status)) {
                        updatedTasksRaw = tasksData.status;
                    }
                } else if (Array.isArray(tasksData)) {
                    updatedTasksRaw = tasksData;
                }
            } else if (Array.isArray(payloadBody)) {
                 updatedTasksRaw = payloadBody;
            }
        }

        const completedTasks = updatedTasksRaw.filter((task: any) => task && task.is_completed === true);

        if (completedTasks.length > 0) {
            console.log(`Received ${completedTasks.length} completed task(s) via Kommo 'update_task' webhook.`);
        }
        return completedTasks;
    },
});
