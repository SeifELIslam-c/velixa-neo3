import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import { config } from './config';

const parseServiceAccount = () => {
  const rawJson = (() => {
    if (config.firebase.serviceAccountJson) {
      return config.firebase.serviceAccountJson;
    }

    if (config.firebase.serviceAccountJsonB64) {
      return Buffer.from(config.firebase.serviceAccountJsonB64, 'base64').toString('utf8');
    }

    return '';
  })();

  if (!rawJson) {
    return null;
  }

  const parsed = JSON.parse(rawJson) as {
    project_id: string;
    client_email: string;
    private_key: string;
  };

  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key.replace(/\\n/g, '\n'),
  };
};

const serviceAccount = parseServiceAccount();

const adminApp =
  getApps()[0] ??
  initializeApp(
    serviceAccount
      ? {
          credential: cert(serviceAccount),
          projectId: serviceAccount.projectId,
        }
      : {
          credential: applicationDefault(),
          projectId: config.firebase.projectId || undefined,
        }
  );

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
