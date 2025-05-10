import { Property, createAction } from "@activepieces/pieces-framework";
import { HttpMethod } from "@activepieces/pieces-common";
import { zagomailAuth } from "../../index";
import { makeZagomailClient } from "../common";

export interface ZagomailCampaignStats {
    campaign_status: string;
    subscribers_count: number;
    processed_count: number;
    delivery_success_count: number;
    delivery_success_rate: number;
    delivery_error_count: number;
    delivery_error_rate: number;
    opens_count: number;
    opens_rate: number;
    unique_opens_count: number;
    unique_opens_rate: number;
    clicks_count: number;
    clicks_rate: number;
    unique_clicks_count: number;
    unique_clicks_rate: number;
    unsubscribes_count: number;
    unsubscribes_rate: number;
    complaints_count: number;
    complaints_rate: number;
    bounces_count: number;
    bounces_rate: number;
    hard_bounces_count: number;
    hard_bounces_rate: number;
    soft_bounces_count: number;
    soft_bounces_rate: number;
    internal_bounces_count: number;
    internal_bounces_rate: number;
}

export interface GetCampaignStatsResponseData {
    data: ZagomailCampaignStats;
}

export const getCampaignStatsAction = createAction({
    auth: zagomailAuth,
    name: 'get_campaign_stats',
    displayName: 'Get Campaign Stats',
    description: 'Retrieves statistics for a specific campaign.',
    props: {
        campaign_uid: Property.ShortText({
            displayName: 'Campaign UID',
            description: 'The UID of the campaign to retrieve stats for.',
            required: true,
        }),
        page: Property.Number({
            displayName: 'Page',
            description: 'Page number for pagination (if stats are paginated, usually not for single campaign stats).',
            required: false,
        }),
        perPage: Property.Number({
            displayName: 'Per Page',
            description: 'Number of items per page (if stats are paginated).',
            required: false,
        }),
    },
    async run(context) {
        const client = makeZagomailClient(context.auth);
        const { campaign_uid, page, perPage } = context.propsValue;

        const requestBody: Record<string, unknown> = {
            publicKey: client.getPublicKey(),
        };
        if (page !== undefined) requestBody['page'] = page;
        if (perPage !== undefined) requestBody['perPage'] = perPage;

        const endpoint = `campaigns/get-stats?campaign_uid=${campaign_uid}`;

        try {
            const response = await client.makeRequest<GetCampaignStatsResponseData>(
                HttpMethod.GET,
                endpoint,
                undefined,
                requestBody
            );

            if (response.data) {
                return response.data;
            } else {
                throw new Error('Failed to get campaign stats: Response data missing despite success status.');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            if (errorMessage.toLowerCase().includes('not found')) {
                 return {
                    message: "Campaign not found.",
                    found: false
                };
            }
            throw new Error(`Error retrieving Zagomail campaign stats: ${errorMessage}`);
        }
    },
});
