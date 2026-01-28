# Privacy Policy

**Last Updated:** January 12, 2026  
**Version:** 1.2.0

## 1. Introduction

ViewBait ("we", "us", "our", or "Service") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered thumbnail generation service.

By using our Service, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our Service.

## 2. Who We Are

**Service Name:** ViewBait  
**Contact Email:** YourIndie101@gmail.com

## 3. Information We Collect

### 3.1 Account Information

When you create an account, we collect:

- **Email address** (required for account creation)
- **Password** (hashed and encrypted, never stored in plain text)
- **OAuth provider information** (if you sign up with Google):
  - Google account ID
  - Email address from Google
  - Profile name and avatar (if provided by Google)
- **Account creation timestamp**
- **Last login timestamp**

This information is stored in our authentication system (Supabase Auth) and linked to your user profile.

### 3.2 Profile Information

We may collect and store the following profile information (stored in the `profiles` table):

- Display name (optional)
- Avatar/profile picture (optional)
- Account preferences and settings
- Subscription tier and status

### 3.3 Content You Create and Upload

When you use the Service, we collect and store:

- **Face images**: Photos you upload for face integration features (stored in Supabase Storage)
- **Reference images**: Images you upload to guide AI generation (stored in Supabase Storage)
- **Generated thumbnails**: AI-generated thumbnail images you create (stored in Supabase Storage)
- **Custom styles**: Style descriptions, prompts, and reference images you create (stored in database and Supabase Storage)
- **Style reference images**: Images you upload for custom styles (stored in Supabase Storage)
- **Style preview images**: AI-generated preview thumbnails for custom styles (stored in Supabase Storage, may be public)
- **Color palettes**: Custom color palettes you create (stored in database)
- **Video titles and topics**: Text you input for thumbnail generation
- **Thumbnail text overlays**: Text you add to thumbnails
- **Favorites**: Thumbnails, styles, or palettes you mark as favorites

This content is stored in our database and file storage systems and is associated with your account.

**AI Processing**: When you generate thumbnails or create style previews, your content (titles, images, style descriptions) is sent to Google Gemini API for AI processing. This includes face images, reference images, and style reference images converted to base64 format. AI prompts are constructed server-side and include your content but are never exposed to the client. See Section 5.1 for details on our use of Google Gemini API.

### 3.4 Usage Data

We automatically collect information about how you use the Service:

- **Generation history**: Records of thumbnails you generate (stored in `thumbnails` table)
- **Credit transactions**: Records of credit usage and allocation (stored in `credit_transactions` table)
- **Feature usage**: Which features you use and how often
- **Session information**: Login times, session duration
- **Device information**: Browser type, operating system, device type (collected automatically by Next.js and Supabase)

### 3.5 Payment and Billing Information

If you subscribe to a paid plan, we collect:

- **Stripe customer ID**: Linked to your account
- **Subscription details**: Plan tier, billing cycle, renewal date (stored in `user_subscriptions` table)
- **Payment events**: Subscription status, payment history, cancellation dates

**Important**: We do NOT store your full credit card number, CVV, or billing address. Payment processing is handled entirely by Stripe, a third-party payment processor. Stripe collects and processes your payment information according to their Privacy Policy.

### 3.6 Legal Acceptance Records

When you accept our Terms of Service and Privacy Policy, we store:

- Terms version accepted
- Privacy Policy version accepted
- Acceptance timestamp
- IP address (hashed, optional)
- User agent string (optional)

This information is stored in the `legal_acceptances` table for compliance and audit purposes.

### 3.7 YouTube Integration Data

If you choose to connect your YouTube account, we collect and store:

- **OAuth access token**: Google OAuth access token for YouTube API access (encrypted at rest)
- **OAuth refresh token**: Google OAuth refresh token for token renewal (encrypted at rest)
- **Google user ID**: Your Google account identifier
- **OAuth scopes granted**: Permissions you grant (currently: `youtube.readonly`, `yt-analytics.readonly`)
- **YouTube channel data**: Cached channel information (channel ID, title, description)
- **YouTube analytics data**: Cached video performance metrics (views, engagement, revenue if monetized)

This data is collected only if you explicitly connect your YouTube account via OAuth. You can revoke access at any time through your Google account settings or by disconnecting the integration in the Service.

### 3.8 Feedback and Support Data

When you submit feedback or support requests, we collect:

- **Feedback message**: Your feedback content
- **Feedback category**: Type of feedback (bug, feature request, etc.)
- **Feedback severity**: Priority level (if provided)
- **Contact information**: Email address and name (if submitting anonymously or for follow-up)
- **Technical context**: Page URL, user agent, device information, app version (automatically collected)

Feedback can be submitted anonymously or while authenticated. Anonymous submissions do not require an account.

### 3.9 Experiment and A/B Testing Data

If you use our experiment features, we collect:

- **Experiment assignments**: Records of experiments you create
- **Experiment variants**: Thumbnail variants you select for testing
- **Analytics sync data**: YouTube Analytics data synced for experiment analysis (if YouTube integration is connected)

This data is optional and only collected if you actively use experiment features.

### 3.10 Technical and Log Data

We automatically collect certain technical information:

- **IP address**: Collected for security, fraud prevention, and service operation
- **Browser information**: User agent, browser type and version
- **Device information**: Device type, operating system
- **Request logs**: API requests, errors, performance metrics (handled by Vercel and Supabase)
- **Error reports**: Crash reports and error logs (if applicable)
- **Performance metrics**: Web Vitals data (optional, not currently actively stored)

This data is collected automatically by our hosting and infrastructure providers (Vercel, Supabase) and our application logging systems.

### 3.11 Cookies and Local Storage

We use cookies and local storage for:

- **Authentication sessions**: To keep you logged in (managed by Supabase Auth)
  - Cookie names: `sb-{project}-auth-token`, `sb-{project}-auth-token-code-verifier`
  - Purpose: Maintain authentication state
  - Duration: Session-based (refreshed automatically)
- **Service functionality**: To remember your preferences and settings (via localStorage)
- **Security**: To prevent fraud and protect your account

**Note**: We do not use third-party analytics cookies or advertising trackers. All cookies are essential for service operation or functional for user preferences.

## 4. How We Use Your Information

We use the information we collect to:

### 4.1 Provide and Operate the Service

- Create and manage your account
- Process your thumbnail generation requests using AI (Google Gemini API)
- Store and organize your generated content, styles, and palettes
- Process payments and manage subscriptions
- Provide customer support
- Connect and manage YouTube integrations (if you choose to connect)
- Display YouTube channel and analytics data (if you choose to connect)

### 4.2 Improve the Service

- Analyze usage patterns to improve features
- Fix bugs and technical issues
- Optimize performance and reliability
- Develop new features based on user needs

### 4.3 Communicate With You

- Send service-related notifications (account updates, subscription changes)
- Respond to your support requests
- Send important updates about the Service or policies (if you have an account)
- Send marketing emails and promotional communications (using SendGrid)

### 4.4 Security and Fraud Prevention

- Detect and prevent fraud, abuse, and security threats
- Verify your identity
- Protect your account and data
- Comply with legal obligations

### 4.5 Legal Compliance

- Comply with applicable laws and regulations
- Respond to legal requests and court orders
- Enforce our Terms of Service
- Protect our rights and the rights of our users

## 5. How We Share Your Information

We do NOT sell your personal information. We share your information only in the following circumstances:

### 5.1 Service Providers (Data Processors)

We share information with third-party service providers who help us operate the Service:

- **Supabase**: Database hosting, authentication, and file storage
  - Data shared: All account data, user content, usage data, authentication data
  - Purpose: Core service operation (database, storage, authentication)
  - Location: Americas (United States)
  - Privacy Policy: [Supabase Privacy Policy](https://supabase.com/privacy)

- **Vercel**: Web hosting and infrastructure
  - Data shared: Request logs, IP addresses, error logs, deployment artifacts
  - Purpose: Hosting and serving the application
  - Location: West Coast, Oregon (United States)
  - Privacy Policy: [Vercel Privacy Policy](https://vercel.com/legal/privacy-policy)

- **Stripe**: Payment processing
  - Data shared: Customer ID, subscription details, payment events (NOT full payment card details, CVV, or billing address)
  - Purpose: Process payments and manage subscriptions
  - Location: United States
  - Privacy Policy: [Stripe Privacy Policy](https://stripe.com/privacy)

- **SendGrid (Twilio)**: Email delivery service
  - Data shared: Email addresses, email content (transactional and marketing)
  - Purpose: Send transactional and marketing emails
  - Location: United States
  - Privacy Policy: [SendGrid Privacy Policy](https://www.twilio.com/legal/privacy)

- **Google Gemini API**: AI image and text generation
  - Data shared: User input (video titles, style descriptions, palette choices), uploaded images (face images, reference images converted to base64), AI-generated prompts (constructed server-side)
  - Purpose: Generate thumbnails, enhance titles, analyze styles and palettes
  - Location: United States
  - Privacy Policy: [Google Privacy Policy](https://policies.google.com/privacy)
  - **Important**: Your content is sent to Google Gemini API for processing. Prompts are constructed server-side and never exposed to the client.

- **Google OAuth** (if you sign up with Google): Authentication
  - Data shared: Authentication tokens, profile information you authorize
  - Purpose: Account creation and authentication
  - Location: United States
  - Privacy Policy: [Google Privacy Policy](https://policies.google.com/privacy)

- **YouTube API** (if you connect YouTube): Channel and analytics data
  - Data shared: OAuth tokens (stored securely, used for API calls to fetch your YouTube data)
  - Purpose: Fetch and display your YouTube channel and analytics data
  - Location: United States
  - Privacy Policy: [YouTube API Terms](https://developers.google.com/youtube/terms/api-services-terms-of-service)
  - **OAuth Scopes**: We request `youtube.readonly` and `yt-analytics.readonly` permissions. You can revoke access at any time.

### 5.2 Public Content

If you choose to share styles, palettes, or other content publicly on the Service:

- Other users can view and use your public content
- Your display name (if set) may be associated with public content
- Your email address and other private information remain private

### 5.3 Legal Requirements

We may disclose your information if required by law, court order, or government regulation, or if we believe disclosure is necessary to:

- Comply with legal obligations
- Protect our rights, property, or safety
- Protect the rights, property, or safety of our users
- Prevent fraud or abuse
- Respond to government requests

### 5.4 Business Transfers

If we are involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you of any such change in ownership or control.

## 6. Data Storage and Retention

### 6.1 Where Your Data Is Stored

Your data is stored on servers operated by our service providers:

- **Database**: Supabase (PostgreSQL) - Americas (United States)
- **File Storage**: Supabase Storage - Americas (United States)
- **Application Hosting**: Vercel - West Coast, Oregon (United States)
- **Payment Processing**: Stripe - United States
- **Email Delivery**: SendGrid (Twilio) - United States

All data is encrypted in transit (HTTPS/TLS) and at rest (provider default encryption).

### 6.2 Data Retention

**Account Data**: Retained until you delete your account or request deletion. Account deletion triggers cascade deletion of all associated data.

**Generated Content**:
- **Free Tier**: Thumbnails are automatically deleted 30 days after creation via our automated retention system. This ensures compliance with our data minimization principles. Other content (styles, palettes, faces) is retained until you delete it or your account is deleted.
- **Paid Tiers**: All content is retained permanently until you delete it or your account is deleted.

**Credit Transactions**: Retained permanently as an immutable audit log (required for subscription and billing records).

**OAuth Tokens**: Retained until you revoke access, disconnect the integration, or delete your account.

**Legal Acceptance Records**: Retained permanently for compliance and audit purposes.

**Feedback and Support Data**: Retained until you request deletion or your account is deleted (if submitted while authenticated). Anonymous feedback may be retained for service improvement purposes.

**Technical and Log Data**: Retained according to our service providers' retention policies (Vercel, Supabase). Typically 30-90 days for logs.

**YouTube Integration Data**: Retained until you disconnect the integration or delete your account. Cached channel and analytics data is retained until you disconnect or delete your account.

**Backup Data**: Supabase provides automatic backups. Backup retention is managed by Supabase according to their policies.

## 7. Your Rights and Choices

### 7.1 Access Your Data

You can access your account information, generated content, and usage data through the Service:

- View your profile information in account settings
- View your generated thumbnails in the Gallery
- View your styles, palettes, and faces in their respective sections
- View your subscription and credit information

### 7.2 Update Your Data

You can update certain information:

- Edit your profile information (name, avatar) in account settings
- Update your email address (requires verification)
- Change your password
- Modify your subscription plan

### 7.3 Delete Your Data

You can delete your data in the following ways:

- **Delete individual items**: Delete specific thumbnails, styles, palettes, or faces through the Service
- **Delete your account**: You can delete your account directly through your account settings in the Service. When you delete your account:
  - All storage files are automatically deleted from all buckets (thumbnails, faces, style-references, style-previews)
  - All database records are automatically deleted via cascade deletion (profiles, subscriptions, thumbnails, styles, palettes, faces, favorites, notifications, and all other associated data)
  - Account deletion requires password confirmation for security
  - The deletion process is immediate and comprehensive - all your data is permanently removed
  - Once deleted, your account and all associated data cannot be recovered

If you need assistance with account deletion, you can also contact us at YourIndie101@gmail.com.

### 7.4 Export Your Data

You can export your data in the following ways:

- **Individual downloads**: Download your generated thumbnails individually (original resolution)
- **Complete data export**: Use the "Export All Data" feature in your account settings to download a complete export of all your data in structured JSON format. This export includes:
  - Your profile information
  - All generated thumbnails metadata
  - Your custom styles, palettes, and faces
  - Your favorites and preferences
  - Subscription and credit transaction history
  - Signed download URLs for all your storage files (valid for 1 year)
- **View through interface**: View your account information, styles, palettes, and usage data through the Service interface

The automated export feature provides immediate access to all your data and complies with GDPR data portability rights. If you need assistance with data export, you can contact us at YourIndie101@gmail.com.

### 7.5 Opt-Out of Communications

You can opt-out of:

- Marketing emails (via notification preferences or unsubscribe links)
- Non-essential service notifications (via account settings)

You cannot opt-out of essential service communications (security alerts, payment confirmations, important policy updates).

### 7.6 Revoke Third-Party Access

You can revoke third-party access:

- **YouTube Integration**: Disconnect YouTube integration in account settings or revoke access through your Google account settings
- **Google OAuth**: Revoke access through your Google account settings (if you signed up with Google)

### 7.7 Regional Privacy Rights

Depending on your location, you may have additional rights:

- **GDPR (European Union)**: Right to access, rectify, erase, restrict processing, data portability (available via automated export feature), and object to processing
- **CCPA (California)**: Right to know, delete, opt-out of sale (we do not sell data), and non-discrimination
- **Other jurisdictions**: Rights may vary by location

To exercise these rights, please contact us at YourIndie101@gmail.com. We will respond within 30 days.

## 8. Security

We implement security measures to protect your information:

- **Encryption**: Data is encrypted in transit (HTTPS/TLS) and at rest (database encryption)
- **Authentication**: Secure password hashing and OAuth authentication
- **Access controls**: Row Level Security (RLS) policies restrict database access
- **Secure storage**: Files stored in secure, access-controlled storage buckets
- **Regular security updates**: We keep our systems and dependencies up to date
- **Environment variables**: Sensitive configuration stored securely, never committed to code

However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.

**Your responsibility**: You are responsible for maintaining the security of your account credentials. Do not share your password with anyone.

## 9. Children's Privacy

Our Service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately. If we learn we have collected information from a child under 13, we will delete that information promptly.

If you are between 13 and 18 years old, you must have your parent's or guardian's permission to use the Service.

## 10. International Data Transfers

Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country.

Specifically:

- Our service providers (Supabase, Vercel, Stripe, SendGrid, Google) may process your data in the United States
- We ensure appropriate safeguards are in place through:
  - Standard Contractual Clauses (SCCs) with our service providers
  - Compliance with applicable data protection laws (GDPR, CCPA, etc.)
  - Data Processing Agreements with our service providers

By using the Service, you consent to the transfer of your information to these locations.

## 11. Third-Party Links and Services

Our Service may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to read their privacy policies.

Third-party services integrated into our Service:

- **Stripe**: Payment processing (see [Stripe Privacy Policy](https://stripe.com/privacy))
- **Google Gemini API**: AI image and text generation (see [Google Privacy Policy](https://policies.google.com/privacy))
- **Google OAuth**: Authentication (see [Google Privacy Policy](https://policies.google.com/privacy))
- **YouTube API**: Channel and analytics data (if you connect YouTube) (see [YouTube API Terms](https://developers.google.com/youtube/terms/api-services-terms-of-service))
- **Supabase**: Infrastructure (see [Supabase Privacy Policy](https://supabase.com/privacy))
- **Vercel**: Hosting (see [Vercel Privacy Policy](https://vercel.com/legal/privacy-policy))
- **SendGrid (Twilio)**: Email delivery (see [SendGrid Privacy Policy](https://www.twilio.com/legal/privacy))

## 12. Cookies and Tracking Technologies

### 12.1 Cookie Consent

When you first visit our Service, you will see a cookie consent banner that explains our use of cookies. We use only essential cookies that are required for the Service to function. By continuing to use our Service, you consent to our use of these essential cookies. For more detailed information about our cookie usage, please see our [Cookie Policy](/cookie-policy).

### 12.2 Cookies We Use

We use cookies and similar technologies for:

- **Essential cookies**: Required for the Service to function
  - Authentication cookies: `sb-{project}-auth-token`, `sb-{project}-auth-token-code-verifier` (managed by Supabase Auth)
  - Purpose: Maintain your login session
  - Duration: Session-based (automatically refreshed)
  - **Note**: These cookies are essential and cannot be disabled without preventing you from using the Service
- **Functional cookies**: Remember your preferences and settings (via localStorage)
  - Cookie consent preference: Stored in localStorage to remember your cookie consent choice
- **Security cookies**: Protect against fraud and security threats

### 12.3 Third-Party Cookies

We do not use third-party analytics or advertising cookies. All cookies are either essential for service operation or functional for user preferences.

### 12.4 Managing Cookies

You can control cookies through your browser settings. However, disabling essential cookies (particularly authentication cookies) will prevent you from using the Service, as they are required for authentication and session management.

For more information about our cookie usage, please visit our [Cookie Policy](/cookie-policy).

## 13. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. We will notify you of material changes by:

- Posting the updated policy on this page with a new "Last Updated" date
- Sending an email to your registered email address (for material changes)
- Displaying a notice on the Service

Your continued use of the Service after changes become effective constitutes acceptance of the updated Privacy Policy.

## 14. Contact Us

If you have questions, concerns, or requests regarding this Privacy Policy or your personal information, please contact us:

**Email:** YourIndie101@gmail.com

We will respond to your inquiry within 30 days.

## 15. Additional Information

### 15.1 Data Controller

ViewBait is the data controller for your personal information.

### 15.2 Supervisory Authority

If you are located in the European Union and have concerns about our data practices, you have the right to lodge a complaint with your local data protection authority.

### 15.3 California Privacy Rights

If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA). See Section 7.7 for details on exercising these rights.

### 15.4 AI Data Processing

When you use our Service to generate thumbnails, enhance titles, or analyze styles, your content is processed by Google Gemini API. This includes:

- **User Input**: Video titles, style descriptions, palette choices
- **Uploaded Images**: Face images, reference images (converted to base64 format)
- **Generated Prompts**: Server-side constructed prompts that include your content

All prompts are constructed server-side and never exposed to the client. Your content is sent to Google Gemini API solely for the purpose of generating thumbnails and providing AI-powered features. Google processes this data according to their Privacy Policy.

### 15.5 Data Processing Legal Basis (GDPR)

We process your personal data based on the following legal bases:

- **Contract**: Processing necessary to provide the Service (account management, thumbnail generation, subscription management)
- **Consent**: Processing based on your explicit consent (OAuth scopes, marketing emails, public content sharing)
- **Legitimate Interest**: Processing for security, fraud prevention, service improvement, and legal compliance
- **Legal Obligation**: Processing required by law (legal acceptance records, compliance with court orders)

---

**By using ViewBait, you acknowledge that you have read and understood this Privacy Policy.**
