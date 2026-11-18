"""Ajusta o projeto Android gerado pelo Capacitor: retrato, vibração, versão e tela cheia."""
import re, sys, pathlib
run = int(sys.argv[1]) if len(sys.argv) > 1 else 1
A = pathlib.Path('android/app/src/main')
m = (A / 'AndroidManifest.xml').read_text()
if 'screenOrientation' not in m:
    m = m.replace('<activity', '<activity\n            android:screenOrientation="portrait"', 1)
if 'android.permission.VIBRATE' not in m:
    m = m.replace('</manifest>', '    <uses-permission android:name="android.permission.VIBRATE" />\n</manifest>')
(A / 'AndroidManifest.xml').write_text(m)
g = pathlib.Path('android/app/build.gradle'); t = g.read_text()
t = re.sub(r'versionCode \d+', 'versionCode %d' % run, t)
t = re.sub(r'versionName "[^"]*"', 'versionName "1.%d"' % run, t)
g.write_text(t)
st = A / 'res/values/styles.xml'; x = st.read_text()
x = re.sub(r'(<style name="AppTheme.NoActionBar"[^>]*>)', r'\1\n        <item name="android:windowFullscreen">true</item>\n        <item name="android:windowBackground">@android:color/black</item>', x, count=1)
st.write_text(x)
print('android ajustado: versao 1.%d' % run)
