// Email Configuration
export const EMAIL_CONFIG = {
  // SMTP Configuration - Update these with your email provider details
  SMTP: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER || 'your-email@gmail.com',
      pass: process.env.SMTP_PASS || 'your-app-password'
    }
  },
  
  // Email settings
  FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@goldentag.com',
  FROM_NAME: process.env.FROM_NAME || 'Golden Tag WLL',
  REPLY_TO: process.env.REPLY_TO_EMAIL || 'support@goldentag.com',
  
  // Company information
  COMPANY: {
    name: 'Golden Tag WLL',
    address: 'Your Company Address',
    phone: '+973-XXXX-XXXX',
    website: 'https://goldentag.com',
    logo: 'https://goldentag.com/logo.png' // Optional: URL to company logo
  }
};

// Email templates for different document types
export const EMAIL_TEMPLATES = {
  INVOICE: {
    subject: 'Invoice #{documentNumber} - {companyName}',
    template: 'invoice-template'
  },
  PROFORMA_INVOICE: {
    subject: 'Proforma Invoice #{documentNumber} - {companyName}',
    template: 'proforma-invoice-template'
  },
  QUOTATION: {
    subject: 'Quotation #{documentNumber} - {companyName}',
    template: 'quotation-template'
  },
  GOODS_RECEIPT: {
    subject: 'Goods Receipt #{documentNumber} - {companyName}',
    template: 'goods-receipt-template'
  },
  SALES_ORDER: {
    subject: 'Sales Order #{documentNumber} - {companyName}',
    template: 'sales-order-template'
  },
  PURCHASE_INVOICE: {
    subject: 'Purchase Invoice #{documentNumber} - {companyName}',
    template: 'purchase-invoice-template'
  }
};
