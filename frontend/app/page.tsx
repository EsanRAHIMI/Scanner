'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface ServiceStatus {
  name: string;
  url: string;
  status: 'loading' | 'online' | 'offline';
  responseTime?: number;
  error?: string;
}

export default function Home() {
  const [isVisible, setIsVisible] = useState(false);
  const [serviceStatuses, setServiceStatuses] = useState<Record<string, ServiceStatus>>({});

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Environment detection
  const isLocal = process.env.NODE_ENV === 'development' || 
                  typeof window !== 'undefined' && 
                  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const trainerUrl = isLocal 
    ? 'http://localhost:3010/'
    : 'https://trainer.ehsanrahimi.com/';

  const productsUrl = isLocal
    ? 'http://localhost:3004'
    : 'https://products.ehsanrahimi.com/';

  const calendarUrl = isLocal
    ? 'http://localhost:3005/calendar'
    : `${productsUrl}/calendar`;

  const marketingUrl = isLocal
    ? 'http://localhost:3005'
    : 'https://marketing.ehsanrahimi.com/';

  const scannerUrl = isLocal
    ? 'http://localhost:3003/scanner'
    : '/scanner';

  const statusUrl = isLocal
    ? 'http://localhost:3003/status'
    : '/status';

  const apiDocsUrl = isLocal
    ? 'http://localhost:8000/docs'
    : 'https://lorenzo.ehsanrahimi.com/api/docs';

  const trainerApiDocsUrl = isLocal
    ? 'http://localhost:8010/docs'
    : 'https://trainer.ehsanrahimi.com/api/docs';

  // Service health check
  useEffect(() => {
    const checkServiceHealth = async (serviceName: string, url: string) => {
      try {
        const startTime = Date.now();
        const response = await fetch(url, { 
          method: 'GET',
          mode: 'no-cors',
          signal: AbortSignal.timeout(5000)
        });
        const endTime = Date.now();
        
        setServiceStatuses(prev => ({
          ...prev,
          [serviceName]: {
            name: serviceName,
            url: url,
            status: 'online',
            responseTime: endTime - startTime
          }
        }));
      } catch (error) {
        setServiceStatuses(prev => ({
          ...prev,
          [serviceName]: {
            name: serviceName,
            url: url,
            status: 'offline',
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }));
      }
    };

    // Check all services
    const services = [
      { name: 'Backend API', url: isLocal ? 'http://localhost:8000/health' : 'https://lorenzo.ehsanrahimi.com/api/health' },
      { name: 'Trainer API', url: isLocal ? 'http://localhost:8010/health' : 'https://trainer.ehsanrahimi.com/api/health' },
      { name: 'Products Service', url: isLocal ? 'http://localhost:3004' : productsUrl },
      { name: 'Marketing Service', url: marketingUrl },
      { name: 'MongoDB', url: isLocal ? 'http://localhost:8000/mongodb/health' : 'https://trainer.ehsanrahimi.com/api/mongodb/health' }
    ];

    // Initial check
    services.forEach(service => {
      setServiceStatuses(prev => ({
        ...prev,
        [service.name]: {
          name: service.name,
          url: service.url,
          status: 'loading'
        }
      }));
    });

    // Check services with delay for loading effect
    setTimeout(() => {
      services.forEach(service => {
        checkServiceHealth(service.name, service.url);
      });
    }, 1000);

    // Set up interval for real-time updates
    const interval = setInterval(() => {
      services.forEach(service => {
        checkServiceHealth(service.name, service.url);
      });
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [isLocal, productsUrl, marketingUrl]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      case 'loading': return 'bg-yellow-500 animate-pulse';
      default: return 'bg-gray-500';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-400';
      case 'offline': return 'text-red-400';
      case 'loading': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden" dir="ltr">
      {/* Background Grid */}
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="absolute inset-0 opacity-20">
          <div className="h-full w-full bg-grid-pattern"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className={`border-b border-gray-800 backdrop-blur-lg bg-black/50 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <div className="container mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">AI Marketing</h1>
                  <p className="text-gray-400 text-sm">Command Dashboard</p>
                </div>
              </div>
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-3">
                  <span className="text-gray-500 text-sm">Services:</span>
                  <div className="flex items-center space-x-2">
                    {Object.entries(serviceStatuses).slice(0, 3).map(([key, service]) => (
                      <div key={key} className="flex items-center space-x-1">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(service.status)}`}></div>
                        <span className={`text-xs ${getStatusTextColor(service.status)}`}>
                          {service.status === 'loading' ? '...' : 
                           service.status === 'online' ? '↑' : '↓'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center space-x-6 text-sm">
                  <span className="text-gray-500">Environment:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isLocal ? 'bg-orange-900/50 text-orange-400 border border-orange-800' : 'bg-green-900/50 text-green-400 border border-green-800'}`}>
                    {isLocal ? 'LOCAL' : 'PRODUCTION'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Dashboard */}
        <main className="flex-1 container mx-auto px-6 py-12">
          <div className="max-w-7xl mx-auto">
            
            {/* Quick Actions */}
            <section className={`mb-12 transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <h2 className="text-xl font-semibold text-gray-300 mb-6">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Link 
                  href={productsUrl}
                  className="group relative overflow-hidden bg-gradient-to-r from-pink-600/20 to-rose-600/20 border border-pink-800/50 rounded-xl p-6 hover:border-pink-600 transition-all duration-300 hover:shadow-lg hover:shadow-pink-600/20"
                >
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 bg-pink-600 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                        </svg>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(serviceStatuses['Products Service']?.status || 'loading')}`}></div>
                        <svg className="w-5 h-5 text-pink-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17"></path>
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Products Manager</h3>
                    <p className="text-gray-400 text-sm">Manage marketing campaigns</p>
                    {serviceStatuses['Products Service']?.responseTime && (
                      <p className="text-gray-500 text-xs mt-2">
                        Response: {serviceStatuses['Products Service'].responseTime}ms
                      </p>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-pink-600/10 to-rose-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </Link>

                <Link 
                  href={scannerUrl}
                  className="group relative overflow-hidden bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-800/50 rounded-xl p-6 hover:border-purple-600 transition-all duration-300 hover:shadow-lg hover:shadow-purple-600/20"
                >
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(serviceStatuses['Backend API']?.status || 'loading')}`}></div>
                        <svg className="w-5 h-5 text-purple-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17"></path>
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Scanner UI</h3>
                    <p className="text-gray-400 text-sm">Analyze and scan marketing data</p>
                    {serviceStatuses['Backend API']?.responseTime && (
                      <p className="text-gray-500 text-xs mt-2">
                        Response: {serviceStatuses['Backend API'].responseTime}ms
                      </p>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </Link>

                <Link 
                  href={trainerUrl}
                  className="group relative overflow-hidden bg-gradient-to-r from-green-600/20 to-teal-600/20 border border-green-800/50 rounded-xl p-6 hover:border-green-600 transition-all duration-300 hover:shadow-lg hover:shadow-green-600/20"
                >
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                        </svg>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(serviceStatuses['Trainer API']?.status || 'loading')}`}></div>
                        <svg className="w-5 h-5 text-green-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17"></path>
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Trainer Dashboard</h3>
                    <p className="text-gray-400 text-sm">Train AI models</p>
                    {serviceStatuses['Trainer API']?.responseTime && (
                      <p className="text-gray-500 text-xs mt-2">
                        Response: {serviceStatuses['Trainer API'].responseTime}ms
                      </p>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-green-600/10 to-teal-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </Link>

                <Link
                  href={marketingUrl}
                  className="group relative overflow-hidden bg-gradient-to-r from-cyan-600/20 to-sky-600/20 border border-cyan-800/50 rounded-xl p-6 hover:border-cyan-600 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-600/20"
                >
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 bg-cyan-600 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          ></path>
                        </svg>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(serviceStatuses['Marketing Service']?.status || 'loading')}`}></div>
                        <svg className="w-5 h-5 text-cyan-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17"></path>
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Digital Marketing OS</h3>
                    <p className="text-gray-400 text-sm">Digital Marketing OS</p>
                    {serviceStatuses['Marketing Service']?.responseTime && (
                      <p className="text-gray-500 text-xs mt-2">
                        Response: {serviceStatuses['Marketing Service'].responseTime}ms
                      </p>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/10 to-sky-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </Link>
              </div>
            </section>

            {/* Service Status Monitor */}
            <section className={`mb-12 transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <h2 className="text-xl font-semibold text-gray-300 mb-6">Service Status Monitor</h2>
              <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Inference API Status */}
                  <Link 
                    href={apiDocsUrl}
                    className="group bg-gray-900/50 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-all duration-300 cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(serviceStatuses['Backend API']?.status || 'loading')}`}></div>
                        <h4 className="text-white font-medium text-sm">Inference API</h4>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className={`text-xs ${getStatusTextColor(serviceStatuses['Backend API']?.status || 'loading')}`}>
                          {serviceStatuses['Backend API']?.status === 'loading' ? 'Checking...' : 
                           serviceStatuses['Backend API']?.status === 'online' ? 'Online' : 'Offline'}
                        </span>
                        <svg className="w-3 h-3 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17"></path>
                        </svg>
                      </div>
                    </div>
                    {serviceStatuses['Backend API']?.responseTime && (
                      <div className="text-gray-500 text-xs">
                        Response: {serviceStatuses['Backend API'].responseTime}ms
                      </div>
                    )}
                    {serviceStatuses['Backend API']?.error && (
                      <div className="text-red-400 text-xs mt-1">
                        {serviceStatuses['Backend API'].error}
                      </div>
                    )}
                  </Link>

                  {/* Trainer API Status */}
                  <Link 
                    href={trainerApiDocsUrl}
                    className="group bg-gray-900/50 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-all duration-300 cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(serviceStatuses['Trainer API']?.status || 'loading')}`}></div>
                        <h4 className="text-white font-medium text-sm">Trainer API</h4>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className={`text-xs ${getStatusTextColor(serviceStatuses['Trainer API']?.status || 'loading')}`}>
                          {serviceStatuses['Trainer API']?.status === 'loading' ? 'Checking...' : 
                           serviceStatuses['Trainer API']?.status === 'online' ? 'Online' : 'Offline'}
                        </span>
                        <svg className="w-3 h-3 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17"></path>
                        </svg>
                      </div>
                    </div>
                    {serviceStatuses['Trainer API']?.responseTime && (
                      <div className="text-gray-500 text-xs">
                        Response: {serviceStatuses['Trainer API'].responseTime}ms
                      </div>
                    )}
                    {serviceStatuses['Trainer API']?.error && (
                      <div className="text-red-400 text-xs mt-1">
                        {serviceStatuses['Trainer API'].error}
                      </div>
                    )}
                  </Link>

                  {/* Products Service Status */}
                  <Link 
                    href={productsUrl}
                    className="group bg-gray-900/50 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-all duration-300 cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(serviceStatuses['Products Service']?.status || 'loading')}`}></div>
                        <h4 className="text-white font-medium text-sm">Products Service</h4>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className={`text-xs ${getStatusTextColor(serviceStatuses['Products Service']?.status || 'loading')}`}>
                          {serviceStatuses['Products Service']?.status === 'loading' ? 'Checking...' : 
                           serviceStatuses['Products Service']?.status === 'online' ? 'Online' : 'Offline'}
                        </span>
                        <svg className="w-3 h-3 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17"></path>
                        </svg>
                      </div>
                    </div>
                    {serviceStatuses['Products Service']?.responseTime && (
                      <div className="text-gray-500 text-xs">
                        Response: {serviceStatuses['Products Service'].responseTime}ms
                      </div>
                    )}
                    {serviceStatuses['Products Service']?.error && (
                      <div className="text-red-400 text-xs mt-1">
                        {serviceStatuses['Products Service'].error}
                      </div>
                    )}
                  </Link>

                  {/* MongoDB Status */}
                  <Link 
                    href={statusUrl}
                    className="group bg-gray-900/50 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-all duration-300 cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(serviceStatuses['MongoDB']?.status || 'loading')}`}></div>
                        <h4 className="text-white font-medium text-sm">MongoDB</h4>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className={`text-xs ${getStatusTextColor(serviceStatuses['MongoDB']?.status || 'loading')}`}>
                          {serviceStatuses['MongoDB']?.status === 'loading' ? 'Checking...' : 
                           serviceStatuses['MongoDB']?.status === 'online' ? 'Connected' : 'Disconnected'}
                        </span>
                        <svg className="w-3 h-3 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17"></path>
                        </svg>
                      </div>
                    </div>
                    {serviceStatuses['MongoDB']?.responseTime && (
                      <div className="text-gray-500 text-xs">
                        Response: {serviceStatuses['MongoDB'].responseTime}ms
                      </div>
                    )}
                    {serviceStatuses['MongoDB']?.error && (
                      <div className="text-red-400 text-xs mt-1">
                        {serviceStatuses['MongoDB'].error}
                      </div>
                    )}
                  </Link>
                </div>
                
                {/* Overall Status */}
                <Link 
                  href={statusUrl}
                  className="group mt-4 pt-4 border-t border-gray-800 block cursor-pointer hover:bg-gray-900/20 -mx-2 px-2 py-1 rounded transition-all duration-300"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(
                        Object.values(serviceStatuses).every(s => s.status === 'online') ? 'online' :
                        Object.values(serviceStatuses).some(s => s.status === 'offline') ? 'offline' : 'loading'
                      )}`}></div>
                      <span className="text-gray-400 text-sm group-hover:text-white transition-colors">
                        Overall Status: {
                          Object.values(serviceStatuses).every(s => s.status === 'online') ? 'All Systems Operational' :
                          Object.values(serviceStatuses).some(s => s.status === 'offline') ? 'Some Services Down' :
                          'Checking Services...'
                        }
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-gray-500 text-xs group-hover:text-gray-400 transition-colors">
                        Auto-refresh every 30s
                      </div>
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17"></path>
                      </svg>
                    </div>
                  </div>
                </Link>
              </div>
            </section>

            {/* Technical Stack */}
            <section className={`transition-all duration-1000 delay-600 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <h2 className="text-xl font-semibold text-gray-300 mb-6">Technical Stack</h2>
              <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-600/20 border border-blue-800 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <span className="text-blue-400 font-bold text-sm">YOLO</span>
                    </div>
                    <h4 className="text-white text-sm font-medium mb-1">YOLOv8</h4>
                    <p className="text-gray-500 text-xs">Computer Vision</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-600/20 border border-green-800 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <span className="text-green-400 font-bold text-sm">API</span>
                    </div>
                    <h4 className="text-white text-sm font-medium mb-1">FastAPI</h4>
                    <p className="text-gray-500 text-xs">Backend Framework</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-purple-600/20 border border-purple-800 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <span className="text-purple-400 font-bold text-sm">NX</span>
                    </div>
                    <h4 className="text-white text-sm font-medium mb-1">Next.js</h4>
                    <p className="text-gray-500 text-xs">Frontend Framework</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-cyan-600/20 border border-cyan-800 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <span className="text-cyan-400 font-bold text-sm">DK</span>
                    </div>
                    <h4 className="text-white text-sm font-medium mb-1">Docker</h4>
                    <p className="text-gray-500 text-xs">Containerization</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      <style jsx>{`
        .bg-grid-pattern {
          background-image: 
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 50px 50px;
        }
      `}</style>
    </div>
  );
}
