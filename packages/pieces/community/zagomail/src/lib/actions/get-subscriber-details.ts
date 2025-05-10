import { Property, createAction } from "@activepieces/pieces-framework";
import { HttpMethod } from "@activepieces/pieces-common";
import { zagomailAuth } from "../../index";
import { makeZagomailClient } from "../common";
import { ZagomailSubscriber } from "./create-subscriber";

export interface GetSubscriberResponseData {
    record?: ZagomailSubscriber;
}

export const getSubscriberDetailsAction = createAction({
    auth: zagomailAuth,
    name: 'get_subscriber_details',
    displayName: 'Get Subscriber Details',
    description: 'Retrieves the details of a specific subscriber in a list.',
    props: {
        list_uid: Property.ShortText({
            displayName: 'List UID',
            description: 'The UID of the list where the subscriber exists.',
            required: true,
        }),
        subscriber_uid: Property.ShortText({
            displayName: 'Subscriber UID',
            description: 'The UID of the subscriber to retrieve.',
            required: true,
        }),
    },
    async run(context) {
        const client = makeZagomailClient(context.auth);
        const { list_uid, subscriber_uid } = context.propsValue;

        const requestBody = {
            publicKey: client.getPublicKey(),
        };

        const endpoint = `lists/get-subscriber?list_uid=${list_uid}&subscriber_uid=${subscriber_uid}`;

        try {
            const response = await client.makeRequest<GetSubscriberResponseData>(
                HttpMethod.GET,
                endpoint,
                undefined,
                requestBody
            );

            if (response.data && response.data.record) {
                return response.data.record;
            }
            return {
                message: "Subscriber details not found or API returned success without data.",
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
            throw new Error(`Error retrieving Zagomail subscriber details: ${errorMessage}`);
        }
    },
});
