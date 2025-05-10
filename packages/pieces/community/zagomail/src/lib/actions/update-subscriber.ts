import { Property, createAction } from "@activepieces/pieces-framework";
import { HttpMethod } from "@activepieces/pieces-common";
import { zagomailAuth } from "../../index";
import { makeZagomailClient } from "../common";
import { ZagomailSubscriber } from "./create-subscriber";

export interface UpdateSubscriberResponseData {
    record: ZagomailSubscriber;
}

export const updateSubscriberAction = createAction({
    auth: zagomailAuth,
    name: 'update_subscriber',
    displayName: 'Update Subscriber',
    description: 'Updates an existing subscriber in a list.',
    props: {
        list_uid: Property.ShortText({
            displayName: 'List UID',
            description: 'The UID of the list where the subscriber exists.',
            required: true,
        }),
        subscriber_uid: Property.ShortText({
            displayName: 'Subscriber UID',
            description: 'The UID of the subscriber to update.',
            required: true,
        }),
        email: Property.ShortText({
            displayName: 'Email',
            description: "The new email address for the subscriber. (Optional)",
            required: false,
        }),
        fname: Property.ShortText({
            displayName: 'First Name',
            description: "The new first name for the subscriber. (Optional)",
            required: false,
        }),
        lname: Property.ShortText({
            displayName: 'Last Name',
            description: "The new last name for the subscriber. (Optional)",
            required: false,
        }),
    },
    async run(context) {
        const client = makeZagomailClient(context.auth);
        const { list_uid, subscriber_uid, email, fname, lname } = context.propsValue;

        const requestBody: Record<string, unknown> = {
            publicKey: client.getPublicKey(),
        };
        if (email) requestBody['email'] = email;
        if (fname) requestBody['fname'] = fname;
        if (lname) requestBody['lname'] = lname;

        if (Object.keys(requestBody).length === 1 && requestBody['publicKey']) {
            throw new Error("No update fields provided.");
        }

        const endpoint = `lists/subscriber-update?list_uid=${list_uid}&subscriber_uid=${subscriber_uid}`;

        try {
            const response = await client.makeRequest<UpdateSubscriberResponseData>(
                HttpMethod.POST,
                endpoint,
                undefined,
                requestBody
            );

            if (response.data && response.data.record) {
                return response.data.record;
            } else {
                throw new Error('Failed to update subscriber: Response data or record missing despite success status.');
            }
        } catch (error) {
            throw new Error(`Error updating Zagomail subscriber: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
        }
    },
});
