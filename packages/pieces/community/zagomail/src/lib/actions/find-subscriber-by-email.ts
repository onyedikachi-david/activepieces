import { Property, createAction } from "@activepieces/pieces-framework";
import { HttpMethod } from "@activepieces/pieces-common";
import { zagomailAuth } from "../../index";
import { makeZagomailClient } from "../common";
import { ZagomailSubscriber } from "./create-subscriber";

export interface FindSubscriberResponseData {
    record?: ZagomailSubscriber;
}

export const findSubscriberByEmailAction = createAction({
    auth: zagomailAuth,
    name: 'find_subscriber_by_email',
    displayName: 'Find Subscriber by Email',
    description: 'Searches for a subscriber in a list by their email address.',
    props: {
        list_uid: Property.ShortText({
            displayName: 'List UID',
            description: 'The UID of the list to search within.',
            required: true,
        }),
        email: Property.ShortText({
            displayName: 'Email',
            description: "The email address to search for.",
            required: true,
        }),
    },
    async run(context) {
        const client = makeZagomailClient(context.auth);
        const { list_uid, email } = context.propsValue;

        const requestBody = {
            publicKey: client.getPublicKey(),
            email: email,
        };

        const endpoint = `lists/search-by-email?list_uid=${list_uid}`;

        try {
            const response = await client.makeRequest<FindSubscriberResponseData>(
                HttpMethod.POST,
                endpoint,
                undefined,
                requestBody
            );

            if (response.data && response.data.record) {
                return response.data.record;
            }
            return {
                message: "Subscriber not found or API returned success without data.",
                found: false
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            if (errorMessage.includes('The subscriber does not exist in this list')) {
                return {
                    message: "Subscriber not found.",
                    found: false
                };
            }
            throw new Error(`Error finding Zagomail subscriber by email: ${errorMessage}`);
        }
    },
});
