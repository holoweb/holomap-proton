echo; echo; echo;
echo "Installing NPM modules..."
echo; echo; echo;
npm i
echo; echo; echo;
echo "Creating SSL keys for local development..."
echo; echo; echo;
mkdir sslcert
./genkeys.sh
echo;echo;echo;
echo "Building production file holomap.build.js"
./build.sh
echo;echo;echo;
echo "INSTALL COMPLETE. If no errors were encountered above, proceed to post-installation setup."
echo;echo;echo;
cat setup.txt
echo;echo;
