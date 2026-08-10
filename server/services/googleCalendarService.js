const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);


const getAuthUrl = () => {
  const scopes = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline', 
    prompt: 'consent',
    scope: scopes
  });
};


const getTokensFromCode = async (code) => {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
};

module.exports = {
  getAuthUrl,
  getTokensFromCode,
  oauth2Client
};