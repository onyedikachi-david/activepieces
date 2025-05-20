import { PieceAuth, createPiece, Property } from '@activepieces/pieces-framework';
import { OAuth2GrantType } from '@activepieces/shared';
import { kommoCreateLead } from './lib/actions/create-lead';
import { kommoUpdateLead } from './lib/actions/update-lead';
import { kommoCreateContact } from './lib/actions/create-contact';
import { kommoUpdateContact } from './lib/actions/update-contact';
import { kommoFindLead } from './lib/actions/find-lead';
import { kommoFindContact } from './lib/actions/find-contact';
import { kommoFindCompany } from './lib/actions/find-company';
import { kommoNewLeadCreated } from './lib/triggers/new-lead-created';
import { kommoLeadStatusChanged } from './lib/triggers/lead-status-changed';
import { kommoNewContactAdded } from './lib/triggers/new-contact-added';
import { kommoTaskCompleted } from './lib/triggers/task-completed';

export const kommo = createPiece({
  displayName: 'Kommo',
  logoUrl: 'https://cdn.activepieces.com/pieces/kommo.png',
  auth: PieceAuth.OAuth2({
    authUrl: 'https://www.kommo.com/oauth',
    tokenUrl: 'https://{props.account_subdomain}.kommo.com/oauth2/access_token',
    scope: [],
    required: true,
    grantType: OAuth2GrantType.AUTHORIZATION_CODE,
    props: {
      account_subdomain: Property.ShortText({
        displayName: 'Account Subdomain',
        description: 'Your Kommo account subdomain (e.g., yourcompany if your URL is yourcompany.kommo.com)',
        required: true,
      }),
    },
  }),
  minimumSupportedRelease: '0.36.1',
  authors: [
    'onyedikachi-david'
  ],
  actions: [
    kommoCreateLead,
    kommoUpdateLead,
    kommoCreateContact,
    kommoUpdateContact,
    kommoFindLead,
    kommoFindContact,
    kommoFindCompany
  ],
  triggers: [
    kommoNewLeadCreated,
    kommoLeadStatusChanged,
    kommoNewContactAdded,
    kommoTaskCompleted
  ],
});
