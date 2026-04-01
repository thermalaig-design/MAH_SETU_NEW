import React from 'react';
import { ShieldCheck, X } from 'lucide-react';

const TermsModal = ({ isOpen, onAccept }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm w-full max-w-[430px] left-1/2 -translate-x-1/2">
      <div className="bg-white w-full max-w-[400px] rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="bg-blue-600 p-6 text-white text-center relative">
          <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
            <ShieldCheck size={32} />
          </div>
          <h2 className="text-2xl font-bold">Terms & Conditions</h2>
          <p className="text-blue-100 text-sm mt-1">Please review and accept to continue</p>
        </div>
        
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4 text-gray-600 text-sm leading-relaxed">
          <section>
            <h3 className="font-bold text-gray-900 mb-1">1. Acceptance of Terms</h3>
            <p>By using this application, you agree to be bound by these Terms and Conditions. This app provides hospital management services for Maharaja Agarsen Hospital.</p>
          </section>
          
          <section>
            <h3 className="font-bold text-gray-900 mb-1">2. Data Privacy</h3>
            <p>We value your privacy. Your personal and medical data is handled securely according to our Privacy Policy. We do not share your sensitive information with third parties without consent.</p>
          </section>
          
          <section>
            <h3 className="font-bold text-gray-900 mb-1">3. User Responsibility</h3>
            <p>You are responsible for maintaining the confidentiality of your account and for all activities that occur under your account.</p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-1">4. Medical Disclaimer</h3>
            <p>The information provided in this app is for informational purposes and does not replace professional medical advice, diagnosis, or treatment.</p>
          </section>

          <section className="bg-blue-50 p-3 rounded-xl border border-blue-100">
            <p className="text-blue-800 font-medium">By clicking "I Accept", you confirm that you have read and agree to our Terms of Service and Privacy Policy.</p>
          </section>
        </div>

        <div className="p-6 border-t border-gray-100 flex flex-col gap-3">
          <button 
            onClick={onAccept}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98]"
          >
            I Accept
          </button>
          <p className="text-center text-xs text-gray-400">
            Last updated: January 2026
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsModal;
