# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## Run Online

1. echo "VITE_API_KEY=" > .env
2. npm run build
3. git init
4. git add .
5. git commit -m "Integrate Vite build process and restructure project"

**Prerequisites:** Github创建新的repository
6. git remote add origin https://github.com/Edelweiss-myt/lanlearner_public.git    # git remote remove origin
7. git branch -M main
8. git push origin main        #此时你的github应该也已更新完成

9. git commit -m "Updated API key handling and fixed build command for Netlify"


VITE_API_KEY=AIzaSyAY1JopshkJP70BA6YASSw2x8dkyV_AcJk


## Update Online
npm run build
git branch
git add . 
git commit -m "Your commit message"
git status  # should be 'no changes added to commit'
git remote -v   # if incorrect github web, git remote remove origin
git remote add origin https://github.com/Edelweiss-myt/lanlearner_v1.git 
git push origin main --force-with-lease



### Version Update
Version 1.1
    1 Add 'Edit' to word
    2 Update ebook (format: word, pdf, epub), the examples of added words will be first searched from ebook, then online resources
