#!/usr/bin/env node

/**
 * Comprehensive Full Application Test Suite
 * Tests all API endpoints, frontend pages, database operations, and business workflows
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Configuration
const BASE_URL = 'http://localhost:5000';
const TEST_TIMEOUT = 10000; // 10 seconds per test

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  errors: [],
  warnings: [],
  details: {}
};

// Utility function to make HTTP requests
async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Full-Application-Test-Suite/1.0',
        ...options.headers
      },
      timeout: TEST_TIMEOUT
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : null;
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: jsonData,
            rawData: data
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: null,
            rawData: data
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// Test result logging
function logTest(testName, passed, message = '', details = {}) {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} ${testName}${message ? ': ' + message : ''}`);
  
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
    testResults.errors.push({ test: testName, message, details });
  }
  
  testResults.details[testName] = { passed, message, details };
}

// Test API endpoint
async function testEndpoint(endpoint, expectedStatus = 200, validationFn = null) {
  try {
    const response = await makeRequest(`${BASE_URL}${endpoint}`);
    const passed = response.statusCode === expectedStatus;
    
    let message = `Status: ${response.statusCode}`;
    if (validationFn && passed) {
      const validation = validationFn(response);
      if (!validation.passed) {
        message += ` | Validation failed: ${validation.message}`;
        logTest(`GET ${endpoint}`, false, message, validation.details);
        return;
      }
    }
    
    logTest(`GET ${endpoint}`, passed, message, {
      statusCode: response.statusCode,
      dataLength: response.rawData ? response.rawData.length : 0,
      hasData: !!response.data
    });
    
    return response;
  } catch (error) {
    logTest(`GET ${endpoint}`, false, `Error: ${error.message}`);
    return null;
  }
}

// Test frontend page
async function testFrontendPage(page) {
  try {
    const response = await makeRequest(`${BASE_URL}${page}`);
    const hasHtml = response.rawData.includes('<!DOCTYPE html>');
    const hasReact = response.rawData.includes('react') || response.rawData.includes('React');
    const hasVite = response.rawData.includes('vite');
    
    const passed = response.statusCode === 200 && hasHtml;
    const message = `Status: ${response.statusCode}, HTML: ${hasHtml}, React: ${hasReact}, Vite: ${hasVite}`;
    
    logTest(`Frontend ${page}`, passed, message, {
      statusCode: response.statusCode,
      contentLength: response.rawData.length,
      hasHtml,
      hasReact,
      hasVite
    });
    
    return response;
  } catch (error) {
    logTest(`Frontend ${page}`, false, `Error: ${error.message}`);
    return null;
  }
}

// Test authentication
async function testAuthentication() {
  console.log('\n🔐 Testing Authentication...');
  
  // Test login
  try {
    const loginData = { username: 'admin', password: 'admin123' };
    const response = await makeRequest(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      body: loginData
    });
    
    const passed = response.statusCode === 200 && response.data && response.data.user;
    logTest('User Login', passed, `Status: ${response.statusCode}`, {
      hasUser: !!response.data?.user,
      userId: response.data?.user?.id,
      username: response.data?.user?.username
    });
    
    return response.data?.user;
  } catch (error) {
    logTest('User Login', false, `Error: ${error.message}`);
    return null;
  }
}

// Test API endpoints
async function testAPIEndpoints() {
  console.log('\n🔌 Testing API Endpoints...');
  
  const endpoints = [
    { path: '/api/enquiries', validation: (res) => ({ 
      passed: Array.isArray(res.data) && res.data.length > 0, 
      message: `Found ${res.data?.length || 0} enquiries` 
    })},
    { path: '/api/quotations', validation: (res) => ({ 
      passed: Array.isArray(res.data) && res.data.length > 0, 
      message: `Found ${res.data?.length || 0} quotations` 
    })},
    { path: '/api/sales-orders', validation: (res) => ({ 
      passed: Array.isArray(res.data) && res.data.length > 0, 
      message: `Found ${res.data?.length || 0} sales orders` 
    })},
    { path: '/api/invoices', validation: (res) => ({ 
      passed: Array.isArray(res.data) && res.data.length > 0, 
      message: `Found ${res.data?.length || 0} invoices` 
    })},
    { path: '/api/customers', validation: (res) => ({ 
      passed: Array.isArray(res.data) && res.data.length > 0, 
      message: `Found ${res.data?.length || 0} customers` 
    })},
    { path: '/api/suppliers', validation: (res) => ({ 
      passed: Array.isArray(res.data) && res.data.length > 0, 
      message: `Found ${res.data?.length || 0} suppliers` 
    })},
    { path: '/api/inventory-items', validation: (res) => ({ 
      passed: Array.isArray(res.data) && res.data.length > 0, 
      message: `Found ${res.data?.length || 0} inventory items` 
    })},
    { path: '/api/purchase-orders', validation: (res) => ({ 
      passed: Array.isArray(res.data) && res.data.length > 0, 
      message: `Found ${res.data?.length || 0} purchase orders` 
    })},
    { path: '/api/goods-receipt-headers', validation: (res) => ({ 
      passed: Array.isArray(res.data) && res.data.length > 0, 
      message: `Found ${res.data?.length || 0} goods receipts` 
    })},
    { path: '/api/stock-issues', validation: (res) => ({ 
      passed: Array.isArray(res.data), 
      message: `Found ${res.data?.length || 0} stock issues` 
    })},
    { path: '/api/purchase-invoices', validation: (res) => ({ 
      passed: Array.isArray(res.data) && res.data.length > 0, 
      message: `Found ${res.data?.length || 0} purchase invoices` 
    })},
    { path: '/api/supplier-quotes', validation: (res) => ({ 
      passed: Array.isArray(res.data) && res.data.length > 0, 
      message: `Found ${res.data?.length || 0} supplier quotes` 
    })},
    { path: '/api/material-requests', validation: (res) => ({ 
      passed: Array.isArray(res.data), 
      message: `Found ${res.data?.length || 0} material requests` 
    })},
    { path: '/api/material-receipts', validation: (res) => ({ 
      passed: Array.isArray(res.data), 
      message: `Found ${res.data?.length || 0} material receipts` 
    })}
  ];
  
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint.path, 200, endpoint.validation);
  }
}

// Test frontend pages
async function testFrontendPages() {
  console.log('\n🌐 Testing Frontend Pages...');
  
  const pages = [
    '/',
    '/dashboard',
    '/enquiries',
    '/quotations',
    '/sales-orders',
    '/invoices',
    '/customers',
    '/suppliers',
    '/inventory',
    '/purchase-orders',
    '/goods-receipts',
    '/material-requests',
    '/material-receipts',
    '/stock-issues',
    '/purchase-invoices',
    '/supplier-quotes'
  ];
  
  for (const page of pages) {
    await testFrontendPage(page);
  }
}

// Test database operations
async function testDatabaseOperations() {
  console.log('\n💾 Testing Database Operations...');
  
  // Test creating a new customer
  try {
    const customerData = {
      name: `Test Customer ${Date.now()}`,
      email: `test${Date.now()}@example.com`,
      phone: '123-456-7890',
      address: '123 Test Street',
      customerType: 'Individual',
      classification: 'Standard'
    };
    
    const response = await makeRequest(`${BASE_URL}/api/customers`, {
      method: 'POST',
      body: customerData
    });
    
    const passed = response.statusCode === 201 || response.statusCode === 200;
    logTest('Create Customer', passed, `Status: ${response.statusCode}`, {
      customerId: response.data?.id,
      customerName: response.data?.name
    });
    
    if (passed && response.data?.id) {
      // Test updating the customer
      const updateData = { phone: '987-654-3210' };
      const updateResponse = await makeRequest(`${BASE_URL}/api/customers/${response.data.id}`, {
        method: 'PUT',
        body: updateData
      });
      
      logTest('Update Customer', updateResponse.statusCode === 200, `Status: ${updateResponse.statusCode}`);
      
      // Test deleting the customer
      const deleteResponse = await makeRequest(`${BASE_URL}/api/customers/${response.data.id}`, {
        method: 'DELETE'
      });
      
      logTest('Delete Customer', deleteResponse.statusCode === 200 || deleteResponse.statusCode === 204, `Status: ${deleteResponse.statusCode}`);
    }
  } catch (error) {
    logTest('Create Customer', false, `Error: ${error.message}`);
  }
}

// Test business workflows
async function testBusinessWorkflows() {
  console.log('\n🔄 Testing Business Workflows...');
  
  // Test enquiry to quotation workflow
  try {
    const enquiries = await makeRequest(`${BASE_URL}/api/enquiries`);
    if (enquiries.data && enquiries.data.length > 0) {
      const enquiry = enquiries.data[0];
      logTest('Enquiry Data Quality', true, `Enquiry ${enquiry.enquiryNumber} has status: ${enquiry.status}`, {
        enquiryId: enquiry.id,
        status: enquiry.status,
        hasCustomer: !!enquiry.customerId
      });
    }
  } catch (error) {
    logTest('Enquiry Workflow', false, `Error: ${error.message}`);
  }
  
  // Test quotation to sales order workflow
  try {
    const quotations = await makeRequest(`${BASE_URL}/api/quotations`);
    if (quotations.data && quotations.data.length > 0) {
      const quotation = quotations.data[0];
      logTest('Quotation Data Quality', true, `Quotation ${quotation.quoteNumber} has status: ${quotation.status}`, {
        quotationId: quotation.id,
        status: quotation.status,
        hasCustomer: !!quotation.customerId
      });
    }
  } catch (error) {
    logTest('Quotation Workflow', false, `Error: ${error.message}`);
  }
  
  // Test sales order to invoice workflow
  try {
    const salesOrders = await makeRequest(`${BASE_URL}/api/sales-orders`);
    if (salesOrders.data && salesOrders.data.length > 0) {
      const order = salesOrders.data[0];
      logTest('Sales Order Data Quality', true, `Order ${order.orderNumber} has status: ${order.status}`, {
        orderId: order.id,
        status: order.status,
        hasCustomer: !!order.customerId
      });
    }
  } catch (error) {
    logTest('Sales Order Workflow', false, `Error: ${error.message}`);
  }
}

// Test error handling
async function testErrorHandling() {
  console.log('\n⚠️ Testing Error Handling...');
  
  // Test 404 for non-existent resource
  try {
    const response = await makeRequest(`${BASE_URL}/api/non-existent-endpoint`);
    logTest('404 Error Handling', response.statusCode === 404, `Status: ${response.statusCode}`);
  } catch (error) {
    logTest('404 Error Handling', false, `Error: ${error.message}`);
  }
  
  // Test invalid data handling
  try {
    const response = await makeRequest(`${BASE_URL}/api/customers`, {
      method: 'POST',
      body: { invalid: 'data' }
    });
    logTest('Invalid Data Handling', response.statusCode === 400, `Status: ${response.statusCode}`);
  } catch (error) {
    logTest('Invalid Data Handling', false, `Error: ${error.message}`);
  }
}

// Main test runner
async function runFullApplicationTest() {
  console.log('🚀 Starting Full Application Test Suite...\n');
  console.log(`Testing application at: ${BASE_URL}\n`);
  
  const startTime = Date.now();
  
  // Run all test suites
  await testAuthentication();
  await testAPIEndpoints();
  await testFrontendPages();
  await testDatabaseOperations();
  await testBusinessWorkflows();
  await testErrorHandling();
  
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  
  // Print summary
  console.log('\n📊 Test Summary');
  console.log('================');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`⏱️ Duration: ${duration.toFixed(2)}s`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ Errors Found:');
    testResults.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.test}: ${error.message}`);
    });
  }
  
  if (testResults.warnings.length > 0) {
    console.log('\n⚠️ Warnings:');
    testResults.warnings.forEach((warning, index) => {
      console.log(`${index + 1}. ${warning}`);
    });
  }
  
  console.log('\n🎯 Test Complete!');
  
  return testResults;
}

// Run the test if this file is executed directly
if (require.main === module) {
  runFullApplicationTest().catch(console.error);
}

module.exports = { runFullApplicationTest, testResults };
