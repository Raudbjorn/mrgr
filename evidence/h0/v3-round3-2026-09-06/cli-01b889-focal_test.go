package cli
import("testing";"flag";"reflect")
func TestH0ArgumentAndAliasBehavior(t *testing.T){
 t.Run("arguments",func(t *testing.T){a:=Args{"one","two"};if a.Get(1)!="two"||a.First()!="one"||a.Get(2)!=""||!reflect.DeepEqual(a.Tail(),[]string{"two"})||!a.Present()||Args(nil).Present(){t.Fatal("argument access contract failed")}})
 t.Run("alias-propagation",func(t *testing.T){s:=flag.NewFlagSet("x",flag.ContinueOnError);s.String("name","default","");s.String("n","default","");if e:=s.Parse([]string{"--n","value"});e!=nil{t.Fatal(e)};if e:=normalizeFlags([]Flag{StringFlag{Name:"name,n"}},s);e!=nil{t.Fatal(e)};if s.Lookup("name").Value.String()!="value"{t.Fatal("alias not propagated")}})
 t.Run("alias-collision",func(t *testing.T){s:=flag.NewFlagSet("x",flag.ContinueOnError);s.String("name","","");s.String("n","","");if e:=s.Parse([]string{"--name","one","--n","two"});e!=nil{t.Fatal(e)};if normalizeFlags([]Flag{StringFlag{Name:"name,n"}},s)==nil{t.Fatal("both aliases accepted")}})
}
