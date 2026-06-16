import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Activity, Zap, Clock } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalCampaigns: 0,
    runningCampaigns: 0,
    completedCampaigns: 0,
  });

  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    const loadStats = async () => {
      if (window.api && window.api.listCampaigns) {
        const campaigns = await window.api.listCampaigns();
        
        const total = campaigns.length;
        const running = campaigns.filter(c => c.status === 'Running').length;
        const completed = campaigns.filter(c => c.status === 'Completed').length;
        
        setStats({
          totalCampaigns: total,
          runningCampaigns: running,
          completedCampaigns: completed,
        });

        const recent = campaigns
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
          .slice(0, 5);
        setRecentActivity(recent);
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 3000);
    return () => clearInterval(interval);
  }, []);

  const statCards = [
    {
      title: 'Total Campaigns',
      value: stats.totalCampaigns,
      icon: Activity,
      color: 'purple',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      title: 'Running Now',
      value: stats.runningCampaigns,
      icon: Zap,
      color: 'blue',
      gradient: 'from-blue-500 to-cyan-500',
      animate: stats.runningCampaigns > 0
    },
    {
      title: 'Completed',
      value: stats.completedCampaigns,
      icon: TrendingUp,
      color: 'yellow',
      gradient: 'from-yellow-500 to-orange-500'
    },
  ];

  return (
    <div className="min-h-screen bg-black p-6 space-y-6">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-blue-500/10 border border-purple-500/20 rounded-3xl p-8"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-blue-500/5 animate-pulse" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Dashboard</h1>
              <p className="text-neutral-400">Overview of your content generation pipeline</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {statCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="group relative bg-neutral-900 border border-neutral-800 rounded-2xl p-6 hover:border-neutral-700 transition-all overflow-hidden"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-neutral-400">{card.title}</span>
                <div className={`w-10 h-10 rounded-xl bg-${card.color}-500/10 flex items-center justify-center`}>
                  <card.icon className={`w-5 h-5 text-${card.color}-400 ${card.animate ? 'animate-pulse' : ''}`} />
                </div>
              </div>
              <div className="text-3xl font-bold text-white">{card.value}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Recent Campaigns</h2>
        </div>
        
        {recentActivity.length > 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
            {recentActivity.map((campaign, index) => (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 + index * 0.05 }}
                className={`p-4 flex items-center justify-between ${
                  index !== recentActivity.length - 1 ? 'border-b border-neutral-800' : ''
                } hover:bg-neutral-800/50 transition-colors`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-neutral-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white">{campaign.name}</h3>
                    <p className="text-xs text-neutral-500">Upwork Campaign</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className={`px-3 py-1 rounded-lg text-xs font-medium ${
                    campaign.status === 'Running' ? 'bg-blue-500/10 text-blue-400' :
                    campaign.status === 'Completed' ? 'bg-green-500/10 text-green-400' :
                    'bg-neutral-800 text-neutral-400'
                  }`}>
                    {campaign.status}
                  </div>
                  <Clock className="w-4 h-4 text-neutral-600" />
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center">
            <Activity className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
            <p className="text-neutral-500">No campaigns yet. Create your first one to get started!</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
