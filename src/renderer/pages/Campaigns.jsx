import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Rocket, Search, Clock, Loader } from 'lucide-react';
import CampaignList from '../components/CampaignList.jsx';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [gptAccounts, setGptAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCampaigns();
    loadGPTAccounts();

    const offStatus = window.api?.onUpworkCampaignStatus?.(() => loadCampaigns());
    const offProgress = window.api?.onProgress?.(() => loadCampaigns());

    return () => {
      offStatus?.();
      offProgress?.();
    };
  }, []);

  const loadCampaigns = async () => {
    try {
      const data = await window.api.listUpworkCampaigns();
      setCampaigns(data);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadGPTAccounts = async () => {
    try {
      const accounts = await window.api.listGPTAccounts();
      setGptAccounts(accounts);
    } catch (err) {
      console.error('Failed to load GPT accounts:', err);
    }
  };

  const handleStart = async (id) => {
    try {
      await window.api.startUpworkCampaign(id);
      await loadCampaigns();
    } catch (err) {
      console.error('Failed to start campaign:', err);
    }
  };

  const handleStop = async (id) => {
    try {
      await window.api.stopUpworkCampaign(id);
      await loadCampaigns();
    } catch (err) {
      console.error('Failed to stop campaign:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await window.api.deleteUpworkCampaign(id);
      await loadCampaigns();
    } catch (err) {
      console.error('Failed to delete campaign:', err);
    }
  };

  return (
    <div className="min-h-screen bg-black p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <Rocket className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Upwork Campaigns</h1>
            <p className="text-sm text-neutral-400">Manage your content generation campaigns</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-sm font-semibold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
        >
          <Plus className="w-4 h-4" /> Create Campaign
        </button>
      </motion.div>

      {/* Campaign List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-8 h-8 text-neutral-500 animate-spin" />
          </div>
        ) : (
          <CampaignList
            campaigns={campaigns}
            onStart={handleStart}
            onStop={handleStop}
            onDelete={handleDelete}
          />
        )}
      </motion.div>

      {/* Create Campaign Modal */}
      <CreateCampaignModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadCampaigns}
        gptAccounts={gptAccounts}
      />
    </div>
  );
}

function CreateCampaignModal({ open, onClose, onSuccess, gptAccounts }) {
  const [name, setName] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [gptAccountId, setGptAccountId] = useState('');
  const [delayBetweenRepos, setDelayBetweenRepos] = useState(900000);
  const [reposPerHour, setReposPerHour] = useState(4);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Campaign name is required');
      return;
    }
    if (!searchInput.trim()) {
      setError('Upwork search input is required');
      return;
    }
    if (!gptAccountId) {
      setError('Please select a GPT account');
      return;
    }

    setCreating(true);
    try {
      await window.api.createUpworkCampaign({
        name: name.trim(),
        upworkSearchInput: searchInput.trim(),
        gptAccountId,
        delayBetweenRepos,
        reposPerHour,
      });
      setName('');
      setSearchInput('');
      setGptAccountId('');
      setDelayBetweenRepos(900000);
      setReposPerHour(4);
      onClose();
      onSuccess();
    } catch (err) {
      setError('Failed to create campaign: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-neutral-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <h2 className="mb-6 text-2xl font-semibold text-white">Create Upwork Campaign</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Campaign Name */}
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-300">Campaign Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., SaaS Automation Jobs"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {/* Upwork Search Input */}
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-300">Upwork Search Query</label>
              <textarea
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="e.g., web scraping automation, API integration, Python bot"
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
              />
              <p className="mt-1 text-xs text-neutral-500">Keywords to search for on Upwork</p>
            </div>

            {/* GPT Account */}
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-300">
                GPT Account <span className="text-neutral-500">({gptAccounts.length} available)</span>
              </label>
              {gptAccounts.length === 0 ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
                  No GPT accounts configured. Add one in Settings first.
                </div>
              ) : (
                <select
                  value={gptAccountId}
                  onChange={(e) => setGptAccountId(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
                >
                  <option value="" disabled>Select a GPT account...</option>
                  {gptAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.cookies?.length || 0} cookies)
                    </option>
                  ))}
                </select>
              )}
            </div>





            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/50 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-lg border border-white/10 text-sm font-medium text-neutral-300 hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" /> Creating...
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4" /> Create Campaign
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
