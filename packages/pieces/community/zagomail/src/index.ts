import { PieceAuth, Property, createPiece } from '@activepieces/pieces-framework';
import { makeZagomailClient } from './lib/common';
import { createSubscriberAction } from './lib/actions/create-subscriber';
import { tagSubscriberAction } from './lib/actions/tag-subscriber';
import { updateSubscriberAction } from './lib/actions/update-subscriber';
import { findSubscriberByEmailAction } from './lib/actions/find-subscriber-by-email';
import { getSubscriberDetailsAction } from './lib/actions/get-subscriber-details';
import { getCampaignStatsAction } from './lib/actions/get-campaign-stats';
import { newSubscriberTrigger } from './lib/triggers/new-subscriber-trigger';
import { subscriberUnsubscribedTrigger } from './lib/triggers/subscriber-unsubscribed-trigger';
import { subscriberTaggedTrigger } from './lib/triggers/subscriber-tagged-trigger';

const markdown = `
To obtain your Zagomail API Keys, follow these steps:

1. Log in to your Zagomail account.
2. Go to **Account > API**.
3. Click on **Generate new keys** to get your Public Key and Private Key.
4. Click on **Save changes**.
`;

export const zagomailAuth = PieceAuth.CustomAuth({
  description: markdown,
  props: {
    publicKey: Property.ShortText({
      displayName: 'Public Key',
      description: 'Your Zagomail Public Key',
      required: true,
    }),
    privateKey: PieceAuth.SecretText({
      displayName: 'Private Key',
      description: 'Your Zagomail Private Key (currently not used for data operations, but required for auth setup)',
      required: true,
    }),
  },
  validate: async ({ auth }) => {
    const client = makeZagomailClient(auth);
    const testAuthResponse = await client.testAuth();
    if (testAuthResponse.valid) {
      return { valid: true };
    } else {
      return {
        valid: false,
        error: testAuthResponse.error || 'Authentication failed. Please check your credentials.',
      };
    }
  },
  required: true,
});

export const zagomail = createPiece({
  displayName: 'Zagomail',
  logoUrl: 'https://cdn.activepieces.com/pieces/zagomail.png',
  auth: zagomailAuth,
  authors: ['onyedikachi-david'],
  actions: [
    createSubscriberAction,
    tagSubscriberAction,
    updateSubscriberAction,
    findSubscriberByEmailAction,
    getSubscriberDetailsAction,
    getCampaignStatsAction
  ],
  triggers: [
    newSubscriberTrigger,
    subscriberUnsubscribedTrigger,
    subscriberTaggedTrigger
  ],
});
