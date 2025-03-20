const config = require('./config');
const os = require('os');


// Track HTTP requests by method
const requestCounts = {
  GET: 0,
  POST: 0,
  PUT: 0,
  DELETE: 0,
  total: 0
};

const authAttempts = {
    success: 0,
    failed: 0
};

let activeUsers = 0;

const pizzaMetrics = {
    sold: 0,
    failed: 0,
    revenue: 0
};

const latencyMetrics = {
    endpoints: {},
    pizzaCreation: []
};

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return Math.round(cpuUsage * 100);
}
  
function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = Math.round((usedMemory / totalMemory) * 100);
  return memoryUsage;
}

// HTTP request middleware
function requestTracker(req, res, next) {
  // Count request by method
  const method = req.method;
  if (requestCounts[method] !== undefined) {
    requestCounts[method]++;
  }
  requestCounts.total++;
  
  const start = Date.now();
  const endpoint = req.path;

  console.log(`Request: ${method} ${endpoint}`);
  // This captures when the response is sent
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    if (!latencyMetrics.endpoints[endpoint]) {
      latencyMetrics.endpoints[endpoint] = [];
    }
    latencyMetrics.endpoints[endpoint].push(duration);
  });
  
  next();
}

function trackAuth(success) {
    if (success) {
      authAttempts.success++;
    } else {
      authAttempts.failed++;
    }
}

function userLogin() {
    activeUsers++;
    console.log(`User logged in. Active users: ${activeUsers}`);
}

function userLogout() {
    if (activeUsers > 0) {
      activeUsers--;
    }
    console.log(`User logged out. Active users: ${activeUsers}`);
}

function trackPizzaPurchase(count, revenue, success) {
    if (success) {
      pizzaMetrics.sold += count;
      pizzaMetrics.revenue += revenue;
    } else {
      pizzaMetrics.failed += count;
    }
    console.log(`Pizza purchase - Count: ${count}, Revenue: $${revenue}, Success: ${success}`);
}

function trackPizzaCreationLatency(duration) {
    latencyMetrics.pizzaCreation.push(duration);
    console.log(`Pizza creation latency: ${duration}ms`);
}

// Send metrics to Grafana
function sendMetricToGrafana(name, value, attributes = {}) {
  // Validate input
  const numericValue = Number(value);
  if (isNaN(numericValue)) {
    console.error(`Invalid metric value for ${name}: ${value}`);
    return;
  }

  // Add your source to attributes
  attributes = { ...attributes, source: config.metrics.source };

  const metric = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics: [
              {
                name: name,
                unit: '1',
                sum: {
                  dataPoints: [
                    {
                      asInt: numericValue,
                      timeUnixNano: Date.now() * 1000000,
                      attributes: [],
                    },
                  ],
                  aggregationTemporality: 'AGGREGATION_TEMPORALITY_CUMULATIVE',
                  isMonotonic: true,
                },
              },
            ],
          },
        ],
      },
    ],
  };

  // Add all attributes to the datapoint
  Object.keys(attributes).forEach((key) => {
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0].sum.dataPoints[0].attributes.push({
      key: key,
      value: { stringValue: String(attributes[key]) },
    });
  });

  // Send to Grafana
  fetch(`${config.metrics.url}`, {
    method: 'POST',
    body: JSON.stringify(metric),
    headers: { 
      Authorization: `Bearer ${config.metrics.apiKey}`, 
      'Content-Type': 'application/json' 
    },
  })
    .then((response) => {
      if (!response.ok) {
        console.error(`Failed to push metric ${name} to Grafana:`, {
          status: response.status,
          statusText: response.statusText,
          metricName: name,
          metricValue: value
        });
      } else {
        console.log(`Pushed metric ${name}: ${value}`);
      }
    })
    .catch((error) => {
      console.error(`Error pushing metric ${name}:`, {
        errorMessage: error.message,
        metricName: name,
        metricValue: value
      });
    });
}

// Send HTTP request metrics every 10 seconds
function startMetricsReporting() {
  return setInterval(() => {
    try {
      // Send each method count
      sendMetricToGrafana('http_requests_total', requestCounts.total);
      sendMetricToGrafana('http_requests_get', requestCounts.GET, { method: 'GET' });
      sendMetricToGrafana('http_requests_post', requestCounts.POST, { method: 'POST' });
      sendMetricToGrafana('http_requests_put', requestCounts.PUT, { method: 'PUT' });
      sendMetricToGrafana('http_requests_delete', requestCounts.DELETE, { method: 'DELETE' });

      // Add system metrics
      const cpuUsage = getCpuUsagePercentage();
      const memoryUsage = getMemoryUsagePercentage();
      sendMetricToGrafana('cpu_usage_percent', cpuUsage);
      sendMetricToGrafana('memory_usage_percent', memoryUsage);

      console.log('Current request counts:', requestCounts);
      console.log('System metrics - CPU: ' + cpuUsage + '%, Memory: ' + memoryUsage + '%');
      
      sendMetricToGrafana('auth_attempts_success', authAttempts.success, { result: 'success' });
      sendMetricToGrafana('auth_attempts_failed', authAttempts.failed, { result: 'failed' });
      
      console.log('Auth metrics - Success: ' + authAttempts.success + ', Failed: ' + authAttempts.failed);

      sendMetricToGrafana('active_users', activeUsers);
      console.log('User metrics - Active users: ' + activeUsers);

      sendMetricToGrafana('pizzas_sold', pizzaMetrics.sold);
      sendMetricToGrafana('pizzas_failed', pizzaMetrics.failed);
      sendMetricToGrafana('pizza_revenue', Math.round(pizzaMetrics.revenue * 100));

      console.log('Pizza metrics - Sold: ' + pizzaMetrics.sold + 
        ', Failed: ' + pizzaMetrics.failed + 
        ', Revenue: $' + pizzaMetrics.revenue.toFixed(2));
    
      Object.entries(latencyMetrics.endpoints).forEach(([endpoint, durations]) => {
          if (durations.length > 0) {
            const avgDuration = durations.reduce((sum, val) => sum + val, 0) / durations.length;
            sendMetricToGrafana('endpoint_latency', Math.round(avgDuration), { endpoint });
          }
      });

      
      // Pizza creation latency
      if (latencyMetrics.pizzaCreation.length > 0) {
        const avgDuration = latencyMetrics.pizzaCreation.reduce((sum, val) => sum + val, 0) / 
                           latencyMetrics.pizzaCreation.length;
        sendMetricToGrafana('pizza_creation_latency', Math.round(avgDuration));
        console.log('Latency metrics - Pizza creation: ' + avgDuration.toFixed(2) + 'ms');
      }
      
      // Reset per-interval counters
      requestCounts.GET = 0;
      requestCounts.POST = 0;
      requestCounts.PUT = 0;
      requestCounts.DELETE = 0;
      requestCounts.total = 0;

      authAttempts.success = 0;
      authAttempts.failed = 0;
      
      pizzaMetrics.sold = 0;
      pizzaMetrics.failed = 0;
      pizzaMetrics.revenue = 0;

      // Reset latency metrics after sending
      latencyMetrics.endpoints = {};
      latencyMetrics.pizzaCreation = [];
    } catch (error) {
      console.error('Error sending metrics', error);
    }
  }, 10000); // every 10 seconds
}

// Initialize metrics reporting
let metricsTimer = null;
function init() {
  if (!metricsTimer) {
    metricsTimer = startMetricsReporting();
    console.log('Metrics reporting initialized');
  }
}

// Clean up on shutdown
function shutdown() {
  if (metricsTimer) {
    clearInterval(metricsTimer);
    metricsTimer = null;
    console.log('Metrics reporting stopped');
  }
}

module.exports = {
  requestTracker,
  trackAuth,
  userLogin,
  userLogout,
  trackPizzaPurchase,
  trackPizzaCreationLatency,
  init,
  shutdown
};