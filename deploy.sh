#!/usr/bin/env bash
set -e
NS=hyd-shop
kubectl create namespace $NS --dry-run=client -o yaml | kubectl apply -f -
kubectl -n $NS create configmap catalog-code --from-file=server.js=catalog/server.js --dry-run=client -o yaml | kubectl apply -f -
kubectl -n $NS create configmap orders-code --from-file=server.js=orders/server.js --dry-run=client -o yaml | kubectl apply -f -
kubectl -n $NS create configmap frontend-files --from-file=frontend/index.html --from-file=frontend/default.conf --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f k8s/app.yaml
kubectl -n $NS rollout restart deploy/catalog deploy/orders deploy/frontend
kubectl -n $NS rollout status deploy/frontend
echo "Open: http://localhost:30080  (minikube: minikube service frontend -n $NS)"
