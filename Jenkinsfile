// Jenkins pipeline for Lakh Bazaar on an E2E Networks Kubernetes cluster.
// Credentials needed in Jenkins:
//   e2e-kubeconfig : "Secret file"  -> kubeconfig downloaded from E2E MyAccount
//   registry-creds : "Username with password" -> your container registry login
pipeline {
  agent any
  options {
    timestamps()
    disableConcurrentBuilds()
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }
  parameters {
    choice(name: 'ACTION', choices: ['DEPLOY', 'ROLLBACK', 'RESTART', 'SCALE', 'STATUS', 'DESTROY'],
           description: 'DEPLOY = build + push + deploy. Others act on the running app.')
    string(name: 'REGISTRY', defaultValue: 'docker.io/YOUR_USER/hyd-shop',
           description: 'Registry path, e.g. docker.io/user/hyd-shop or your-registry.example.com/hyd-shop')
    string(name: 'FRONTEND_REPLICAS', defaultValue: '2', description: 'SCALE: frontend replicas')
    string(name: 'CATALOG_MIN_REPLICAS', defaultValue: '2', description: 'SCALE: catalog minimum replicas (autoscaler goes up to 6)')
    booleanParam(name: 'CONFIRM_DESTROY', defaultValue: false, description: 'Tick to allow DESTROY')
  }
  environment {
    NS = 'hyd-shop'
    KUBECONFIG = credentials('e2e-kubeconfig')
  }
  stages {
    stage('Init') {
      steps {
        script {
          def sha = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
          env.TAG = "${env.BUILD_NUMBER}-${sha}"
          currentBuild.displayName = "#${env.BUILD_NUMBER} ${params.ACTION} ${env.TAG}"
        }
        sh 'kubectl version --client && kubectl cluster-info | head -2'
      }
    }

    stage('Validate') {
      when { expression { params.ACTION == 'DEPLOY' } }
      steps {
        sh '''
          node --check catalog/server.js
          node --check orders/server.js
          REGISTRY=$REGISTRY TAG=$TAG envsubst '${REGISTRY} ${TAG}' < k8s-e2e/app.yaml | kubectl apply --dry-run=client -f -
        '''
      }
    }

    stage('Build & Push Images') {
      when { expression { params.ACTION == 'DEPLOY' } }
      steps {
        withCredentials([usernamePassword(credentialsId: 'registry-creds', usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
          sh '''
            echo "$REG_PASS" | docker login "${REGISTRY%%/*}" -u "$REG_USER" --password-stdin
            for s in catalog orders frontend; do
              docker build --platform linux/amd64 -t $REGISTRY/$s:$TAG -t $REGISTRY/$s:latest ./$s
              docker push $REGISTRY/$s:$TAG
              docker push $REGISTRY/$s:latest
            done
          '''
        }
      }
    }

    stage('Deploy') {
      when { expression { params.ACTION == 'DEPLOY' } }
      steps {
        withCredentials([usernamePassword(credentialsId: 'registry-creds', usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
          sh '''
            kubectl create namespace $NS --dry-run=client -o yaml | kubectl apply -f -
            kubectl -n $NS create secret docker-registry regcred \
              --docker-server="${REGISTRY%%/*}" --docker-username="$REG_USER" --docker-password="$REG_PASS" \
              --dry-run=client -o yaml | kubectl apply -f -
            envsubst '${REGISTRY} ${TAG}' < k8s-e2e/app.yaml | kubectl apply -f -
            for d in catalog orders frontend; do kubectl -n $NS rollout status deploy/$d --timeout=180s; done
          '''
        }
      }
    }

    stage('Smoke Test') {
      when { expression { params.ACTION == 'DEPLOY' || params.ACTION == 'RESTART' || params.ACTION == 'ROLLBACK' } }
      steps {
        script {
          def n = sh(returnStdout: true, script: '''
            kubectl -n $NS run smoke-$BUILD_NUMBER --rm -i --restart=Never --quiet --image=curlimages/curl -- \
              sh -c "curl -sf http://frontend/api/catalog/products | grep -o '\\"id\\"' | wc -l"
          ''').trim()
          echo "Products served through the frontend: ${n}"
          if (n != '100') { error("Smoke test failed: expected 100 products, got ${n}") }
          sh 'kubectl -n $NS run smoke2-$BUILD_NUMBER --rm -i --restart=Never --quiet --image=curlimages/curl -- curl -sf http://frontend/api/orders/stores > /dev/null'
        }
      }
    }

    stage('Rollback') {
      when { expression { params.ACTION == 'ROLLBACK' } }
      steps {
        sh '''
          for d in catalog orders frontend; do kubectl -n $NS rollout undo deploy/$d; done
          for d in catalog orders frontend; do kubectl -n $NS rollout status deploy/$d --timeout=180s; done
        '''
      }
    }

    stage('Restart') {
      when { expression { params.ACTION == 'RESTART' } }
      steps {
        sh '''
          kubectl -n $NS rollout restart deploy/catalog deploy/orders deploy/frontend
          for d in catalog orders frontend; do kubectl -n $NS rollout status deploy/$d --timeout=180s; done
        '''
      }
    }

    stage('Scale') {
      when { expression { params.ACTION == 'SCALE' } }
      steps {
        sh '''
          kubectl -n $NS scale deploy/frontend --replicas=$FRONTEND_REPLICAS
          kubectl -n $NS patch hpa catalog -p "{\\"spec\\":{\\"minReplicas\\":$CATALOG_MIN_REPLICAS}}"
        '''
      }
    }

    stage('Destroy') {
      when { expression { params.ACTION == 'DESTROY' } }
      steps {
        script { if (!params.CONFIRM_DESTROY) { error('Tick CONFIRM_DESTROY to delete the application.') } }
        sh 'kubectl delete namespace $NS --ignore-not-found'
      }
    }

    stage('Status') {
      when { expression { params.ACTION != 'DESTROY' } }
      steps {
        sh '''
          kubectl -n $NS get deploy,pods,svc,hpa -o wide
          echo "--- App address (LoadBalancer):"
          kubectl -n $NS get svc frontend -o jsonpath='{.status.loadBalancer.ingress[0].ip}{.status.loadBalancer.ingress[0].hostname}{"\\n"}'
        '''
      }
    }
  }
  post {
    failure {
      script {
        if (params.ACTION == 'DEPLOY') {
          echo 'Deploy failed, rolling back to the previous version'
          sh 'for d in catalog orders frontend; do kubectl -n $NS rollout undo deploy/$d || true; done'
        }
      }
    }
    always { sh 'docker logout "${REGISTRY%%/*}" || true' }
  }
}
