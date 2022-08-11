# Testflight-Changelogs
Testflight에 업로드된 빌드에 WhatsNew 설정을 위한 로컬 서버입니다.  
Fastlane Pilot의 changelog와 유사하게 동작합니다.  
AppStoreConnect API를 활용합니다.

# Install & Start
프로젝트 Root 디렉토리에 env 폴더를 생성하고, `.env`파일을 추가합니다.
```shell
PORT=4000         # 로컬 서버 포트
KEY_ID=''         # 앱스토어 커넥트 Key id (e.g. U2ABCDEFGI)
ISSUER_ID=''      # 앱스토어 커넥트 Issuer id (e.g. 12a3de45-612f-11e2-e235-abhc1cgga1d6)
INTERVAL_MINUTE=3 # 빌드 확인 Task의 주기
RETRY_COUNT=10    # 빌드 확인 Task반복 횟수
```

env 폴더에 앱스토어 커넥트 로그인을 위한 인증서를 추가합니다.  
인증서의 파일명은 `certificate.p8`로 지정해야 합니다.

node 패키지를 설치하고, 실행합니다.
```shell
npm install
npm start
```

# How to use
로컬 서버로 `POST /changelog`를 요청합니다.  
app_id, build_number, changelog 파라미터를 필요로 합니다.

## curl
```Shell
curl -d '{"app_id":"123456789", "build_number":"1.0.1234567", "changelog":"hello world!"}' \
-H "Content-Type: application/json" \
-X POST http://localhost:4000/changelog
```

## ruby
```ruby
def post_changelog(app_id, changelog)
  url = "http://localhost:4000/changelog"
  body = {app_id: app_id, build_number: build_number, changelog: changelog}.to_json
  response = Faraday.post(
    url, 
    body,
    'Content-Type' => 'application/json'
  )
    
  case response.status
  when 200...300 || 302
      puts "[SUCCESS] Succeeded to post changelog."
  else
      puts "[ERROR] Failed to post changelog."
  end
end
```
