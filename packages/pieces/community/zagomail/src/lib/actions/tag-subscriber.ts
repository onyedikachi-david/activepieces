import { Property, createAction } from "@activepieces/pieces-framework";
import { HttpMethod } from "@activepieces/pieces-common";
import { zagomailAuth } from "../../index";
import { makeZagomailClient } from "../common";

export const tagSubscriberAction = createAction({
    auth: zagomailAuth,
    name: 'tag_subscriber',
    displayName: 'Tag Subscriber',
    description: 'Adds a tag to an existing subscriber.',
    props: {
        list_uid: Property.ShortText({
            displayName: 'List UID',
            description: 'The UID of the list where the subscriber exists.',
            required: true,
        }),
        subscriber_uid: Property.ShortText({
            displayName: 'Subscriber UID',
            description: 'The UID of the subscriber to tag.',
            required: true,
        }),
        ztag_id: Property.Number({
            displayName: 'Tag ID (ztag_id)',
            description: 'The numerical ID of the tag to add.',
            required: true,
        }),
    },
    async run(context) {
        const client = makeZagomailClient(context.auth);
        const { list_uid, subscriber_uid, ztag_id } = context.propsValue;

        const endpoint = `lists/add-tag?ztag_id=${ztag_id}&subscriber_uid=${subscriber_uid}&list_uid=${list_uid}`;

        const requestBody = {
            publicKey: client.getPublicKey(),
        };

        try {
            const response = await client.makeRequest<Record<string, never>>(
                HttpMethod.POST,
                endpoint,
                undefined,
                requestBody
            );

            return {
                success: true,
                message: response.message || "Tag added successfully!",
            };

        } catch (error) {
            throw new Error(`Error tagging Zagomail subscriber: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
        }
    },
});
