const axios = require('axios');
const config = require('../config/env');

/**
 * Base SMS Provider Class / Interface
 */
class BaseSmsProvider {
  // eslint-disable-next-line no-unused-vars
  async sendSMS(to, message) {
    throw new Error('sendSMS method must be implemented by provider');
  }
}

/**
 * Fast2SMS Provider Implementation
 */
class Fast2SmsProvider extends BaseSmsProvider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
    this.apiUrl = 'https://www.fast2sms.com/dev/bulkV2';
  }

  async sendSMS(to, message) {
    // Sanitize 10-digit Indian mobile number
    const cleanedNumber = to.replace(/\D/g, '').slice(-10);

    const response = await axios.post(
      this.apiUrl,
      {
        route: 'q',
        message,
        language: 'english',
        flash: 0,
        numbers: cleanedNumber,
      },
      {
        headers: {
          authorization: this.apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    return {
      success: response.data.return === true || response.data.status_code === 200,
      provider: 'fast2sms',
      data: response.data,
    };
  }
}

/**
 * Twilio SMS Provider Implementation
 */
class TwilioSmsProvider extends BaseSmsProvider {
  constructor(accountSid, authToken, fromPhone) {
    super();
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.fromPhone = fromPhone;
  }

  async sendSMS(to, message) {
    // Format to E.164 if needed
    let formattedPhone = to.trim();
    if (!formattedPhone.startsWith('+')) {
      // Default to +91 if 10 digits
      const digits = formattedPhone.replace(/\D/g, '');
      formattedPhone = digits.length === 10 ? `+91${digits}` : `+${digits}`;
    }

    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    const params = new URLSearchParams();
    params.append('To', formattedPhone);
    params.append('From', this.fromPhone);
    params.append('Body', message);

    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      params.toString(),
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      }
    );

    return {
      success: !!response.data.sid,
      provider: 'twilio',
      messageSid: response.data.sid,
      data: response.data,
    };
  }
}

/**
 * MSG91 SMS Provider Implementation
 */
class Msg91SmsProvider extends BaseSmsProvider {
  constructor(authKey) {
    super();
    this.authKey = authKey;
    this.apiUrl = 'https://api.msg91.com/api/v2/sendsms';
  }

  async sendSMS(to, message) {
    const cleanedNumber = to.replace(/\D/g, '').slice(-10);

    const payload = {
      sender: 'ASSOCN',
      route: '4',
      country: '91',
      sms: [
        {
          message,
          to: [cleanedNumber],
        },
      ],
    };

    const response = await axios.post(this.apiUrl, payload, {
      headers: {
        authkey: this.authKey,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    return {
      success: response.data.type === 'success',
      provider: 'msg91',
      data: response.data,
    };
  }
}

/**
 * Console Fallback SMS Provider (Used when API keys are not provided or in dev mode)
 */
class ConsoleSmsProvider extends BaseSmsProvider {
  async sendSMS(to, message) {
    console.log('\n================== [SMS SIMULATION] ==================');
    console.log(`To: ${to}`);
    console.log(`Message:\n${message}`);
    console.log('======================================================\n');
    return {
      success: true,
      provider: 'console_fallback',
      simulated: true,
    };
  }
}

/**
 * Provider Factory
 */
function createSmsProvider() {
  const providerType = config.sms.provider;

  try {
    if (providerType === 'twilio' && config.sms.twilioSid && config.sms.twilioAuthToken && config.sms.twilioPhone) {
      return new TwilioSmsProvider(
        config.sms.twilioSid,
        config.sms.twilioAuthToken,
        config.sms.twilioPhone
      );
    }

    if (providerType === 'fast2sms' && config.sms.apiKey && config.sms.apiKey !== 'your_sms_api_key_here') {
      return new Fast2SmsProvider(config.sms.apiKey);
    }

    if (providerType === 'msg91' && config.sms.apiKey && config.sms.apiKey !== 'your_sms_api_key_here') {
      return new Msg91SmsProvider(config.sms.apiKey);
    }
  } catch (err) {
    console.warn(`[SMS Provider Warning]: Could not initialize ${providerType}: ${err.message}. Falling back to console.`);
  }

  return new ConsoleSmsProvider();
}

const defaultProvider = createSmsProvider();

/**
 * Helper to send single SMS
 */
async function sendSMS(to, message) {
  try {
    return await defaultProvider.sendSMS(to, message);
  } catch (err) {
    console.error(`[SMS Error] Failed to send SMS to ${to}:`, err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Formats and broadcasts SOS Alert SMS to all emergency contacts
 * @param {Array<{ phone: string, name: string, contact_type: string }>} contacts
 * @param {Object} alertDetails
 */
async function sendSOSAlert(contacts, alertDetails) {
  const {
    member_name,
    member_code,
    door_no,
    street,
    phone,
    emergency_type,
    created_at,
    latitude,
    longitude,
  } = alertDetails;

  const timeStr = created_at
    ? new Date(created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    : new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  let locationLine = 'Location: Not provided';
  if (latitude && longitude) {
    locationLine = `Location: https://maps.google.com/?q=${latitude},${longitude}`;
  }

  const message = [
    `EMERGENCY SOS ALERT!`,
    `Type: ${emergency_type || 'General Emergency'}`,
    `Resident: ${member_name || 'Resident'} (${member_code ? `Code: ${member_code}` : 'No Code'})`,
    `Door: ${door_no || 'N/A'}, Street: ${street || 'N/A'}`,
    `Phone: ${phone || 'N/A'}`,
    `Time: ${timeStr}`,
    locationLine,
    `Please respond immediately!`,
  ].join('\n');

  if (!Array.isArray(contacts) || contacts.length === 0) {
    console.warn('[SOS Alert] No contacts provided to dispatch SMS.');
    return [];
  }

  const results = await Promise.allSettled(
    contacts.map(async (contact) => {
      const res = await sendSMS(contact.phone, message);
      return {
        contact: contact.name,
        phone: contact.phone,
        type: contact.contact_type,
        result: res,
      };
    })
  );

  return results.map((r) => (r.status === 'fulfilled' ? r.value : { error: r.reason }));
}

module.exports = {
  BaseSmsProvider,
  Fast2SmsProvider,
  TwilioSmsProvider,
  Msg91SmsProvider,
  ConsoleSmsProvider,
  createSmsProvider,
  sendSMS,
  sendSOSAlert,
};
