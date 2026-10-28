import importlib.util
import json
import os
import runpy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec=importlib.util.spec_from_file_location("bootstrap",Path(__file__).resolve().parents[1]/"scripts"/"bootstrap-local-api.py")
bootstrap=importlib.util.module_from_spec(spec)
spec.loader.exec_module(bootstrap)

class BootstrapRecoveryTests(unittest.TestCase):
    def test_target_port_defaults_and_explicit_override(self):
        script = Path(__file__).resolve().parents[1] / 'scripts' / 'bootstrap-local-api.py'
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(runpy.run_path(str(script))['BASE'], 'http://127.0.0.1:59865')
        with patch.dict(os.environ, {'APP_PORT': '23456'}):
            self.assertEqual(runpy.run_path(str(script))['BASE'], 'http://127.0.0.1:23456')

    def setUp(self):
        self.directory=tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        bootstrap.STATE=Path(self.directory.name)/"bootstrap.json"
        bootstrap.state={'keys':{},'results':{},'requests':{}}

    def test_retry_after_lost_response_reuses_original_intent_and_version(self):
        initial={'currentSummary':'Original authorized synthesis'}
        with patch.object(bootstrap,'call',side_effect=TimeoutError('response lost')) as first:
            with self.assertRaises(TimeoutError):
                bootstrap.once('execution','POST','/task/execution-summaries',initial,7)
            original_args=first.call_args
        bootstrap.state=json.loads(bootstrap.STATE.read_text())
        with patch.object(bootstrap,'call',return_value={'id':'existing-response'}) as retry:
            result=bootstrap.once('execution','POST','/task/execution-summaries',{'currentSummary':'Different UI state'},99)
            self.assertEqual(retry.call_args,original_args)
            self.assertEqual(result,{'id':'existing-response'})
        with patch.object(bootstrap,'call') as no_repeat:
            bootstrap.once('execution','POST','/task/execution-summaries',initial,100)
            no_repeat.assert_not_called()

    def test_failed_atomic_replace_preserves_last_valid_journal(self):
        bootstrap.save()
        previous=bootstrap.STATE.read_bytes()
        bootstrap.state['keys']['intent']='new-key'
        with patch.object(bootstrap.os,'replace',side_effect=OSError('replacement failed')):
            with self.assertRaises(OSError):bootstrap.save()
        self.assertEqual(bootstrap.STATE.read_bytes(),previous)
        self.assertEqual(json.loads(previous)['keys'],{})

if __name__=='__main__':unittest.main()
