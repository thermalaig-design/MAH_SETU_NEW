import React, { useState } from 'react';
import { ChevronLeft, Send, Users, CheckCircle, AlertCircle, Loader, MessageSquare } from 'lucide-react';

const API_BASE_URL = import.meta.env.DEV
    ? 'https://mah.contractmitra.in/api'
    : 'https://mah.contractmitra.in/api';

const SendMessagePage = ({ onBack }) => {
    const [targetAudience, setTargetAudience] = useState('Both'); // 'Trustee' | 'Patron' | 'Both'
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null); // { success, message }

    const handleSend = async () => {
        if (!title.trim()) {
            setResult({ success: false, message: 'Please enter a notification title.' });
            return;
        }
        if (!message.trim()) {
            setResult({ success: false, message: 'Please enter a notification message.' });
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const response = await fetch(`${API_BASE_URL}/notifications/admin/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title.trim(),
                    message: message.trim(),
                    target_audience: targetAudience,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setResult({ success: true, message: `✅ Notification sent to all ${targetAudience} members!` });
                setTitle('');
                setMessage('');
            } else {
                setResult({ success: false, message: data.message || 'Failed to send notification.' });
            }
        } catch (err) {
            console.error('Error sending admin notification:', err);
            setResult({ success: false, message: 'Network error. Please check your connection.' });
        } finally {
            setLoading(false);
        }
    };

    const audienceOptions = [
        { id: 'Trustee', label: 'Trustees Only', color: 'bg-blue-100 text-blue-700 border-blue-300', activeColor: 'bg-blue-600 text-white border-blue-600' },
        { id: 'Patron', label: 'Patrons Only', color: 'bg-purple-100 text-purple-700 border-purple-300', activeColor: 'bg-purple-600 text-white border-purple-600' },
        { id: 'Both', label: 'Both (All Members)', color: 'bg-green-100 text-green-700 border-green-300', activeColor: 'bg-indigo-600 text-white border-indigo-600' },
    ];

    return (
        <div className="min-h-screen bg-gray-50 pb-10">
            {/* Header */}
            <div className="bg-white sticky top-0 z-50 border-b border-gray-200 px-4 py-4 flex items-center gap-3 shadow-sm">
                <button
                    onClick={onBack}
                    className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                >
                    <ChevronLeft className="h-5 w-5 text-gray-700" />
                </button>
                <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-indigo-600" />
                    <h1 className="text-lg font-bold text-gray-800">Send Notification</h1>
                </div>
            </div>

            <div className="px-4 pt-6 space-y-5">
                {/* Target Audience */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-3">
                        <Users className="h-5 w-5 text-indigo-600" />
                        <h2 className="font-semibold text-gray-800">Send To</h2>
                    </div>
                    <div className="flex flex-col gap-2">
                        {audienceOptions.map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => setTargetAudience(opt.id)}
                                className={`w-full py-3 px-4 rounded-xl border-2 font-semibold text-sm transition-all text-left ${targetAudience === opt.id ? opt.activeColor : opt.color
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Compose Notification */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <h2 className="font-semibold text-gray-800 mb-4">Compose Notification</h2>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Important Announcement"
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            maxLength={100}
                        />
                        <p className="text-xs text-gray-400 mt-1">{title.length}/100</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Message <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Type your notification message here..."
                            rows={5}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none"
                            maxLength={500}
                        />
                        <p className="text-xs text-gray-400 mt-1">{message.length}/500</p>
                    </div>
                </div>

                {/* Preview */}
                {(title || message) && (
                    <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
                        <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">Preview</p>
                        <h3 className="font-semibold text-gray-800 text-sm">{title || '(No title)'}</h3>
                        <p className="text-gray-600 text-xs mt-1 whitespace-pre-wrap">{message || '(No message)'}</p>
                        <p className="text-xs text-indigo-400 mt-2 font-medium">
                            Recipients: {targetAudience === 'Both' ? 'All Trustees & Patrons' : `${targetAudience}s Only`}
                        </p>
                    </div>
                )}

                {/* Result */}
                {result && (
                    <div className={`rounded-2xl p-4 flex items-start gap-3 ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                        {result.success
                            ? <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                            : <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        }
                        <p className={`text-sm font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                            {result.message}
                        </p>
                    </div>
                )}

                {/* Send Button */}
                <button
                    onClick={handleSend}
                    disabled={loading || !title.trim() || !message.trim()}
                    className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200"
                >
                    {loading
                        ? <><Loader className="h-5 w-5 animate-spin" /> Sending...</>
                        : <><Send className="h-5 w-5" /> Send Notification</>
                    }
                </button>

                <p className="text-xs text-gray-400 text-center pb-2">
                    This notification will appear in the bell icon and Notifications screen for all matching members.
                </p>
            </div>
        </div>
    );
};

export default SendMessagePage;
