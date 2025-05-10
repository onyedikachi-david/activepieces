import { Property, createAction } from "@activepieces/pieces-framework";
import { HttpMethod } from "@activepieces/pieces-common";
import { zagomailAuth } from "../../index";
import { makeZagomailClient } from "../common";

export interface ZagomailSubscriber {
    subscriber_uid: string;
    email: string;
    ip_address?: string;
    source?: string;
    date_added?: {
        expression?: string;
        params?: string[];
    };
}

export interface CreateSubscriberResponseData {
    record: ZagomailSubscriber;
}

export const createSubscriberAction = createAction({
    auth: zagomailAuth,
    name: 'create_subscriber',
    displayName: 'Create Subscriber',
    description: 'Creates a new subscriber in a list.',
    props: {
        list_uid: Property.ShortText({
            displayName: 'List UID',
            description: 'The UID of the list to add the subscriber to.',
            required: true,
        }),
        email: Property.ShortText({
            displayName: 'Email',
            description: "The subscriber's email address.",
            required: true,
        }),
        fname: Property.ShortText({
            displayName: 'First Name',
            description: "The subscriber's first name.",
            required: false,
        }),
        lname: Property.ShortText({
            displayName: 'Last Name',
            description: "The subscriber's last name.",
            required: false,
        }),
    },
    async run(context) {
        const client = makeZagomailClient(context.auth);
        const { list_uid, email, fname, lname } = context.propsValue;

        const requestBody: Record<string, unknown> = {
            publicKey: client.getPublicKey(),
            email: email,
        };
        if (fname) {
            requestBody['fname'] = fname;
        }
        if (lname) {
            requestBody['lname'] = lname;
        }

        const endpoint = `lists/subscriber-create?list_uid=${list_uid}`;

        try {
            const response = await client.makeRequest<CreateSubscriberResponseData>(
                HttpMethod.POST,
                endpoint,
                undefined,
                requestBody
            );
            if (response.data && response.data.record) {
                return response.data.record;
            } else {
                throw new Error('Failed to create subscriber: Response data or record missing despite success status.');
            }
        } catch (error) {
            throw new Error(`Error creating Zagomail subscriber: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
        }
    },
});
