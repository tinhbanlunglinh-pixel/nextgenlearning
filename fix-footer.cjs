const fs = require('fs');

const file = 'e:/2026/App/19. Learning Nextgen/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const newFooter = `      <footer className="bg-brand-900 text-white border-t-[10px] border-brand-800 pt-20 pb-10">
        <div className="max-w-[1400px] mx-auto px-6 text-center md:text-left">
          <div className="grid md:grid-cols-3 gap-12 items-start mb-16">
            <div className="space-y-6 flex flex-col items-center md:items-start text-center md:text-left">
              <div className="bg-white p-4 rounded-[2rem] w-fit shadow-xl border-4 border-brand-300"><NextgenEnglishLogo className="w-20 h-20" color="#15803d" /></div>
              <div><h3 className="font-black text-2xl text-brand-300 uppercase leading-none font-display">NEXTGEN ENGLISH</h3><p className="text-white font-black text-base mt-2 opacity-90 italic">“Learn English, Lead the way”</p></div>
            </div>
            <div className="space-y-6 text-center md:text-left">
              <h4 className="font-black text-brand-300 text-xl uppercase tracking-[0.2em] border-b-2 border-white/10 pb-2 font-sans">Liên Hệ</h4>
              <ul className="space-y-4 font-black text-brand-100 text-lg">
                <li className="flex items-start gap-3">📍<span>Số 32 Tổ 31B K9, Quang Trung, Phường Uông Bí, Quảng Ninh</span></li>
                <li className="flex items-center gap-3">📞<a href="tel:0986197229" className="hover:text-white transition-colors">Hotline: 0986 197 229 / 0334 141 989</a></li>
                <li className="flex items-center gap-3">✉️<a href="mailto:nextgen.uongbi@gmail.com" className="hover:text-white transition-colors text-base">nextgen.uongbi@gmail.com</a></li>
                <li className="flex items-center gap-3">🌐<a href="https://www.facebook.com/NextgenEnglish" target="_blank" className="hover:text-white transition-colors underline decoration-2">Fanpage Facebook</a></li>
              </ul>
            </div>
            <div className="space-y-6 text-center md:text-left">
                <h4 className="font-black text-brand-300 text-xl uppercase tracking-[0.2em] border-b-2 border-white/10 pb-2 font-sans">Slogan</h4>
                <div className="bg-white/5 p-8 rounded-[2rem] border-2 border-white/10 shadow-xl backdrop-blur-sm"><p className="text-xl font-black italic text-white mb-3 leading-tight">“Learn English, Lead the way”</p><p className="text-brand-300 font-black text-base uppercase tracking-widest font-sans">HỌC TIẾNG ANH . DẪN LỐI TƯƠNG LAI.</p></div>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-brand-200 text-sm">
            <p>© 2026 Nextgen English. Một trường Anh ngữ chuyên nghiệp & hiện đại.</p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white transition-colors">Chính sách bảo mật</a>
              <span className="text-white/20">|</span>
              <a href="#" className="hover:text-white transition-colors">Điều khoản dịch vụ</a>
            </div>
          </div>
        </div>
      </footer>`;

const footerRegex = /<footer className="bg-brand-900 text-white border-t-\[10px\] border-brand-800 pt-20 pb-10">[\s\S]*?<\/footer>/;
content = content.replace(footerRegex, newFooter);

// Also fix the header NEXTGEN ENGLISH color
content = content.replace(/text-highlight-400 uppercase tracking-tighter font-display">ENGLISH NEXTGEN ENGLISH/g, 'text-brand-300 uppercase tracking-tighter font-display">NEXTGEN ENGLISH');
content = content.replace(/text-highlight-400 uppercase tracking-tighter font-display">NEXTGEN ENGLISH/g, 'text-brand-300 uppercase tracking-tighter font-display">NEXTGEN ENGLISH');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed footer');
