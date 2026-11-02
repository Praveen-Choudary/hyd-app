// =====================================================================
// Lakh Bazaar - production Jenkins pipeline (E2E Networks Kubernetes)
// Jenkins credentials required:
//   e2e-kubeconfig : Secret file                -> kubeconfig from E2E MyAccount
//   registry-creds : Username with password     -> container registry login
// Agent tools required: docker, kubectl, envsubst (gettext-base), git, node
// Optional: Slack Notification plugin (set SLACK_CHANNEL to enable)
// =====================================================================

def notify(String color, String msg) {
  if (params.SLACK_CHANNEL?.trim()) {
    try { slackSend(channel: params.SLACK_CHANNEL, color: color, message: msg) }
    catch (e) { echo "Slack notification skipped: ${e.message}" }
  }
}

pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()                       // never two deploys at once
    timeout(time: 60, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '10'))
  }

  // Fallback poll; prefer a Git webhook for instant builds.
  triggers { pollSCM('H/5 * * * *') }

  parameters {
    choice(name: 'ACTION', choices: ['DEPLOY', 'ROLLBACK', 'RESTART', 'SCALE', 'STATUS', 'DESTROY'],
           description: 'DEPLOY builds, scans, pushes and deploys. Other actions operate on the running app.')
    string(name: 'REGISTRY', defaultValue: 'docker.io/YOUR_USER/hyd-shop', description: 'Registry path, e.g. registry.example.com/hyd-shop')
    string(name: 'ALLOWED_BRANCH', defaultValue: 'main', description: 'DEPLOY is only allowed from this branch')
    booleanParam(name: 'REQUIRE_APPROVAL', defaultValue: true, description: 'Manual approval gate before production deploy')
    string(name: 'APPROVERS', defaultValue: '', description: 'Comma-separated Jenkins users or groups allowed to approve (empty = any user with access)')
    choice(name: 'SCAN_SEVERITY', choices: ['CRITICAL', 'HIGH,CRITICAL'], description: 'Image scan fails the build at this severity')
    booleanParam(name: 'SKIP_SCAN', defaultValue: false, description: 'Skip the vulnerability scan (not recommended)')
    string(name: 'FRONTEND_REPLICAS', defaultValue: '2', description: 'SCALE: frontend replicas')
    string(name: 'CATALOG_MIN_REPLICAS', defaultValue: '2', description: 'SCALE: catalog minimum replicas (autoscaler max is 6)')
    string(name: 'DESTROY_CONFIRM', defaultValue: '', description: 'DESTROY: type the namespace name (hyd-shop) to confirm')
    string(name: 'SLACK_CHANNEL', defaultValue: '', description: 'Optional Slack channel for notifications, e.g. #deployments')
  }

  environment {
    NS              = 'hyd-shop'
    SERVICES        = 'catalog orders frontend'
    KUBECONFIG      = credentials('e2e-kubeconfig')
    DOCKER_BUILDKIT = '1'
  }

  stages {

    stage('Preflight') {
      steps {
        script {
          env.GIT_SHA = sh(script: 'git rev-parse --short=8 HEAD', returnStdout: true).trim()
          env.TAG = "${env.BUILD_NUMBER}-${env.GIT_SHA}"
          currentBuild.displayName = "#${env.BUILD_NUMBER} ${params.ACTION} ${env.TAG}"

          if (params.ACTION == 'DEPLOY') {
            if (params.REGISTRY.contains('YOUR_USER')) { error('Set the REGISTRY parameter to your real registry path.') }
            def branch = (env.GIT_BRANCH ?: '').replaceFirst('^origin/', '')
            if (branch != params.ALLOWED_BRANCH) {
              error("Production deploys are only allowed from '${params.ALLOWED_BRANCH}' (current: '${branch}').")
            }
          }
          if (params.ACTION == 'SCALE') {
            if (!(params.FRONTEND_REPLICAS ==~ /\d+/) || !(params.CATALOG_MIN_REPLICAS ==~ /\d+/)) { error('Replica values must be whole numbers.') }
          }
          if (params.ACTION == 'DESTROY' && params.DESTROY_CONFIRM != env.NS) {
            error("Type '${env.NS}' in DESTROY_CONFIRM to delete the application.")
          }
        }
        sh '''
          set -eu
          for t in docker kubectl envsubst git; do command -v $t >/dev/null || { echo "Missing tool on agent: $t"; exit 1; }; done
          kubectl cluster-info | head -1
          echo "Cluster user can manage deployments: $(kubectl auth can-i create deployments -n $NS || true)"
        '''
      }
    }

    stage('Static Checks') {
      when { expression { params.ACTION == 'DEPLOY' } }
      steps {
        sh '''
          set -eu
          node --check catalog/server.js
          node --check orders/server.js
          REGISTRY=$REGISTRY TAG=$TAG envsubst '${REGISTRY} ${TAG}' < k8s-e2e/app.yaml | kubectl apply --dry-run=client -f -
        '''
      }
    }

    stage('Build Images') {
      when { expression { params.ACTION == 'DEPLOY' } }
      steps {
        sh '''
          set -eu
          for s in $SERVICES; do
            docker build --pull --platform linux/amd64 \
              --label org.opencontainers.image.revision=$GIT_SHA \
              --label org.opencontainers.image.source="$GIT_URL" \
              --label ci.build.url="$BUILD_URL" \
              -t $REGISTRY/$s:$TAG ./$s
          done
        '''
      }
    }

    stage('Vulnerability Scan') {
      when { allOf { expression { params.ACTION == 'DEPLOY' }; expression { !params.SKIP_SCAN } } }
      steps {
        sh '''
          set -eu
          for s in $SERVICES; do
            echo "Scanning $s"
            docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v trivy-cache:/root/.cache/ \
              aquasec/trivy:0.57.1 image --quiet --exit-code 1 --severity "$SCAN_SEVERITY" --ignore-unfixed $REGISTRY/$s:$TAG
          done
        '''
      }
    }

    stage('Push Images') {
      when { expression { params.ACTION == 'DEPLOY' } }
      steps {
        withCredentials([usernamePassword(credentialsId: 'registry-creds', usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
          retry(3) {
            sh '''
              set -eu
              echo "$REG_PASS" | docker login "${REGISTRY%%/*}" -u "$REG_USER" --password-stdin
              for s in $SERVICES; do docker push $REGISTRY/$s:$TAG; done
            '''
          }
        }
      }
    }

    stage('Approval') {
      when { allOf { expression { params.ACTION == 'DEPLOY' }; expression { params.REQUIRE_APPROVAL } } }
      steps {
        script {
          notify('warning', "Approval needed: deploy ${env.TAG} to production. ${env.BUILD_URL}input")
          timeout(time: 30, unit: 'MINUTES') {
            input message: "Deploy ${env.TAG} to production (${env.NS})?", ok: 'Deploy', submitter: params.APPROVERS
          }
        }
      }
    }

    stage('Deploy') {
      when { expression { params.ACTION == 'DEPLOY' } }
      steps {
        script { env.DEPLOY_STARTED = 'true' }
        withCredentials([usernamePassword(credentialsId: 'registry-creds', usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
          sh '''
            set -eu
            kubectl create namespace $NS --dry-run=client -o yaml | kubectl apply -f -
            kubectl -n $NS create secret docker-registry regcred \
              --docker-server="${REGISTRY%%/*}" --docker-username="$REG_USER" --docker-password="$REG_PASS" \
              --dry-run=client -o yaml | kubectl apply -f -

            # Audit trail: snapshot of what is currently running, and the planned diff
            mkdir -p audit
            kubectl -n $NS get deploy,svc,hpa -o yaml > audit/before-$TAG.yaml 2>/dev/null || true
            envsubst '${REGISTRY} ${TAG}' < k8s-e2e/app.yaml > audit/rendered-$TAG.yaml
            kubectl diff -f audit/rendered-$TAG.yaml > audit/diff-$TAG.patch || true

            kubectl apply -f audit/rendered-$TAG.yaml
            for d in $SERVICES; do
              kubectl -n $NS annotate deploy/$d kubernetes.io/change-cause="Jenkins #$BUILD_NUMBER $TAG" --overwrite
            done
            for d in $SERVICES; do kubectl -n $NS rollout status deploy/$d --timeout=300s; done
          '''
        }
      }
    }

    stage('Smoke Test') {
      when { expression { params.ACTION in ['DEPLOY', 'RESTART', 'ROLLBACK'] } }
      steps {
        retry(3) {
          sh '''
            set -eu
            run() { kubectl -n $NS run "smoke-$BUILD_NUMBER-$RANDOM" --rm -i --restart=Never --quiet --image=curlimages/curl:8.10.1 -- "$@" 2>/dev/null; }
            run curl -sf --max-time 10 http://frontend/api/catalog/products > products.json
            COUNT=$(grep -o '"id":' products.json | wc -l)
            [ "$COUNT" -eq 100 ] || { echo "Expected 100 products, got $COUNT"; exit 1; }
            run curl -sf --max-time 10 http://frontend/api/orders/stores | grep -q 'Banjara Hills'
            run curl -sf --max-time 10 -o /dev/null http://frontend/
            echo "Smoke test passed: $COUNT products, stores API and frontend healthy"
          '''
        }
      }
    }

    stage('Rollback') {
      when { expression { params.ACTION == 'ROLLBACK' } }
      steps {
        sh '''
          set -eu
          for d in $SERVICES; do kubectl -n $NS rollout undo deploy/$d; done
          for d in $SERVICES; do kubectl -n $NS rollout status deploy/$d --timeout=300s; done
        '''
      }
    }

    stage('Restart') {
      when { expression { params.ACTION == 'RESTART' } }
      steps {
        sh '''
          set -eu
          kubectl -n $NS rollout restart deploy/catalog deploy/orders deploy/frontend
          for d in $SERVICES; do kubectl -n $NS rollout status deploy/$d --timeout=300s; done
        '''
      }
    }

    stage('Scale') {
      when { expression { params.ACTION == 'SCALE' } }
      steps {
        sh '''
          set -eu
          kubectl -n $NS scale deploy/frontend --replicas=$FRONTEND_REPLICAS
          kubectl -n $NS patch hpa catalog -p "{\\"spec\\":{\\"minReplicas\\":$CATALOG_MIN_REPLICAS}}"
        '''
      }
    }

    stage('Destroy') {
      when { expression { params.ACTION == 'DESTROY' } }
      steps {
        sh 'kubectl delete namespace $NS --ignore-not-found'
      }
    }

    stage('Report') {
      when { expression { params.ACTION != 'DESTROY' } }
      steps {
        sh '''
          kubectl -n $NS get deploy,pods,svc,hpa -o wide
          kubectl -n $NS rollout history deploy/frontend | tail -5 || true
          echo "App address: $(kubectl -n $NS get svc frontend -o jsonpath='{.status.loadBalancer.ingress[0].ip}{.status.loadBalancer.ingress[0].hostname}')"
        '''
      }
    }
  }

  post {
    success {
      archiveArtifacts artifacts: 'audit/**', allowEmptyArchive: true
      script { notify('good', "SUCCESS ${params.ACTION} ${env.TAG} - ${env.BUILD_URL}") }
    }
    failure {
      archiveArtifacts artifacts: 'audit/**', allowEmptyArchive: true
      script {
        if (params.ACTION == 'DEPLOY' && env.DEPLOY_STARTED == 'true') {
          echo 'Deploy or smoke test failed: rolling back to the previous revision'
          sh '''
            for d in $SERVICES; do kubectl -n $NS rollout undo deploy/$d || true; done
            for d in $SERVICES; do kubectl -n $NS rollout status deploy/$d --timeout=180s || true; done
          '''
          notify('danger', "FAILED ${env.TAG}, automatically rolled back - ${env.BUILD_URL}")
        } else {
          notify('danger', "FAILED ${params.ACTION} ${env.TAG} - ${env.BUILD_URL}")
        }
      }
    }
    aborted { script { notify('warning', "ABORTED ${params.ACTION} ${env.TAG} - ${env.BUILD_URL}") } }
    cleanup {
      sh '''
        for s in $SERVICES; do docker rmi $REGISTRY/$s:$TAG >/dev/null 2>&1 || true; done
        docker logout "${REGISTRY%%/*}" >/dev/null 2>&1 || true
      '''
      deleteDir()
    }
  }
}
