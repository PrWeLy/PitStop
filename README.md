# PitStop

Bir FastAPI uygulaması arayüzü ve API'yi birlikte sunar. Kullanıcılar, araçlar, bakımlar ve oturumlar Python'un yerleşik SQLite modülüyle saklanır. Uvicorn, FastAPI sunucusunu çalıştırır.

## Çalıştırma

Python 3.10 veya üzeri gerekir. Komutları PitStop klasöründe çalıştır.

**Windows (PowerShell)**

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload
```

**Linux ve macOS**

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn backend.main:app --reload
```

[http://localhost:8000](http://localhost:8000) adresini aç. **Sign Up** ile hesap oluştur, **My Garage** bölümünde araç ekle ve **Maintenance** bölümünde bakım kaydı oluştur. **Expenses** yalnızca tamamlanan bakımların giderlerini toplar. API belgeleri [http://localhost:8000/docs](http://localhost:8000/docs) adresindedir.

Bulut önizlemesi için sunucu komutuna `--host 0.0.0.0` ekle ve 8000 numaralı portu aç.

## API endpoint’leri

[/docs](http://localhost:8000/docs) üzerinden `POST /api/login` veya `POST /api/register` ile oturum aç. Tarayıcı oturum çerezini sonraki isteklere ekler.

| Yöntem | Yol | İşlem |
| --- | --- | --- |
| POST | `/api/register` | Hesap oluştur |
| POST | `/api/login` | Giriş yap |
| POST | `/api/logout` | Oturumu kapat |
| GET | `/api/dashboard` | Hesabı, araçları ve bakım kayıtlarını getir |
| GET | `/api/vehicles` | Araçları listele |
| POST | `/api/vehicles` | Araç ekle |
| PUT | `/api/vehicles/{vehicle_id}` | Araç kaydını güncelle |
| DELETE | `/api/vehicles/{vehicle_id}` | Aracı ve ona bağlı bakım kayıtlarını sil |
| GET | `/api/maintenance` | Bakımları listele |
| POST | `/api/maintenance` | Bakım kaydı ekle |
| PUT | `/api/maintenance/{record_id}` | Bakım kaydını güncelle |
| DELETE | `/api/maintenance/{record_id}` | Bakım kaydını sil |

`PUT` için aynı kaydın `POST` isteğindeki alanları gönder. Bakım maliyeti istekte `cost` alanında TL, yanıtta `cost_cents` alanında kuruş olarak gösterilir.

## Veritabanı ve eski hesaplar

SQLite dosyası ilk açılışta `data/pitstop.sqlite3` yolunda oluşur. Farklı bir konum için `PITSTOP_DB_PATH` ortam değişkenini kullan.

Yeni şifreler Python'un yerleşik PBKDF2 işleviyle hash'lenir. Önceki Argon2 sürümünde oluşturduğun bir hesabın varsa, mevcut SQLite dosyasıyla aşağıdaki komutu çalıştırıp şifreni bir kez yenile. Araç ve bakım kayıtların aynı hesapta kalır.

```sh
.venv/bin/python -m backend.passwords senin-adresin@example.com
```

Windows'ta `.venv/bin/python` yerine `.\.venv\Scripts\python.exe` kullan.
