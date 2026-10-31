# رفع الموقع على GitHub وربطه مع Netlify (من الجوال)

## الرفع إلى GitHub
GitHub على الجوال لا يقبل سحب المجلدات، لذلك ارفعي كل مجلد على حدة بالترتيب:
1. ملفات الجذر (netlify.toml وpackage.json) إلى جذر المستودع.
2. ملفات public (ملفات فقط، بدون مجلدات) إلى مجلد public.
3. ملفات القصص إلى public/stories.
4. الصور إلى public/assets/images (على دفعات لا تزيد على 100 ملف)، والمصغّرات إلى public/assets/images/t.
5. ملفات الدوال site.mjs وcontent.mjs إلى netlify/functions.
لإنشاء مجلد جديد: Add file ثم Create new file، واكتبي الاسم مع الشرطة المائلة، مثل netlify/functions/.gitkeep.

## الربط مع Netlify
1. app.netlify.com ثم Add new site ثم Import an existing project ثم GitHub ثم اختاري المستودع.
2. Build command: اتركيه فارغاً. Publish directory: public. Functions directory: netlify/functions.
3. Site configuration ثم Environment variables: أضيفي COZY_LINA_ADMIN_TOKEN بقيمة سرية طويلة (24 حرفاً فأكثر). لا تضعيها في أي ملف.
4. Deploys ثم Trigger deploy لإعادة النشر.
5. Forms: بعد أول نشر يظهر نموذج newsletter، ومنه تصلك الإيميلات.
6. Domains: اربطي cozylina.net، وأضيفي SITE_URL في Environment variables.
